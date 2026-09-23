// Cliente de existencias contra la API de Connekta (SIESA).
//
// Reemplaza al intermediario kx-endpoints. La consulta dinámica vive registrada en
// Connekta bajo el nombre que trae la plantilla de API_EXISTENCIAS; aquí sólo se
// arma la URL, se autentica y se interpreta la respuesta.
//
// Forma de una respuesta exitosa (verificada contra el ambiente real):
//   {
//     "codigo": 0,
//     "mensaje": "Transacción Exitosa",
//     "detalle": {
//       "tamaño_página": 100, "página_actual": 1, "total_páginas": 1, "total_registros": 1,
//       "Datos": [ { "LineaRegistro":1, "id_item":1070, "item":"VASO 9 OZ",
//                    "costo_unitario":138.33, "existencia":92000.0 } ]
//     }
//   }
// Un error llega con codigo != 0 y "detalle" como texto.

const fetch = require('node-fetch');

const TIMEOUT_MS = 12000;

// Llaves donde puede venir el arreglo de filas, en orden de preferencia.
const LLAVES_FILAS = ['Datos', 'datos', 'data', 'Table', 'table', 'registros', 'resultado', 'rows'];

// Llaves de las que se puede leer la existencia dentro de una fila. Es una lista
// cerrada a propósito: un barrido genérico terminaría leyendo 'id_item' o
// 'costo_unitario' y reportándolos como inventario.
const LLAVES_EXISTENCIA = ['existencia', 'inventario', 'stock', 'disponible', 'saldo', 'cantidad'];

// Lee la primera variable de entorno con valor, probando varias grafías y, como
// último recurso, sin distinguir mayúsculas. En Azure estas vienen de las App
// Settings, y los nombres originales mezclan mayúsculas (ConniKey, ConniToken).
function envAny(...nombres) {
  for (const n of nombres) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  const buscados = nombres.map((n) => n.toLowerCase());
  for (const clave of Object.keys(process.env)) {
    if (!buscados.includes(clave.toLowerCase())) continue;
    const v = process.env[clave];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

function getConfig() {
  return {
    plantilla: envAny('API_EXISTENCIAS'),
    conniKey: envAny('ConniKey', 'CONNI_KEY', 'CONNIKEY'),
    conniToken: envAny('ConniToken', 'CONNI_TOKEN', 'CONNITOKEN')
  };
}

// Arma la URL a partir de la plantilla de .env, sustituyendo {item_ext}.
// La plantilla trae valores con '=', '|' y espacios sin codificar
// (p.ej. "parametros=item_ext = {item_ext}"), así que hay que partir cada par por
// el PRIMER '=' y codificar el valor completo. Se usa encodeURIComponent (espacio
// como %20) porque es lo que acepta Connekta; URLSearchParams lo codificaría como '+'.
function construirUrl(plantilla, itemExt) {
  const corte = plantilla.indexOf('?');
  if (corte === -1) throw new Error('API_EXISTENCIAS no tiene query string');

  const base = plantilla.slice(0, corte);
  const pares = plantilla.slice(corte + 1).split('&').filter(Boolean).map((par) => {
    const i = par.indexOf('=');
    const clave = i === -1 ? par : par.slice(0, i);
    const valor = i === -1 ? '' : par.slice(i + 1);
    const resuelto = valor.replace(/\{item_ext\}/g, String(itemExt));
    return `${encodeURIComponent(clave)}=${encodeURIComponent(resuelto)}`;
  });

  return `${base}?${pares.join('&')}`;
}

// Convierte a número sólo lo que de verdad es un número.
// Clave: Number('') devuelve 0, así que una cadena sin dígitos NUNCA debe llegar a Number().
function aNumero(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val !== 'string') return null;

  const s = val.trim();
  if (!/\d/.test(s)) return null;

  let limpio = s.replace(/[^\d.,-]/g, '');
  const coma = limpio.lastIndexOf(',');
  const punto = limpio.lastIndexOf('.');

  if (coma > -1 && punto > -1) {
    // El separador decimal es el que aparece de último.
    const miles = coma > punto ? '.' : ',';
    limpio = limpio.split(miles).join('');
    if (coma > punto) limpio = limpio.replace(',', '.');
  } else if (coma > -1) {
    const decimales = limpio.length - coma - 1;
    limpio = (decimales === 1 || decimales === 2)
      ? limpio.replace(',', '.')
      : limpio.split(',').join('');
  }

  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function extraerFilas(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return null;

  for (const k of LLAVES_FILAS) {
    if (Array.isArray(json[k])) return json[k];
  }
  // Un nivel más adentro: es donde Connekta las pone ({ detalle: { Datos: [...] } }).
  for (const k of Object.keys(json)) {
    const v = json[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k2 of LLAVES_FILAS) {
        if (Array.isArray(v[k2])) return v[k2];
      }
    }
  }
  return null;
}

function existenciaDeFila(fila) {
  if (fila == null) return null;
  if (typeof fila !== 'object') return aNumero(fila);

  const porMinuscula = new Map(Object.keys(fila).map((k) => [k.toLowerCase(), k]));
  for (const candidata of LLAVES_EXISTENCIA) {
    const real = porMinuscula.get(candidata);
    if (real === undefined) continue;
    const v = aNumero(fila[real]);
    if (v != null) return v;
  }
  return null;
}

// Traduce la respuesta cruda a un resultado discriminado:
//   { ok: true,  unidades, filas }   |   { ok: false, motivo, detalle }
function interpretar(json) {
  if (json == null) return { ok: false, motivo: 'respuesta_vacia' };

  const esObjeto = typeof json === 'object' && !Array.isArray(json);

  if (esObjeto && json.codigo != null) {
    const cod = Number(json.codigo);
    if (Number.isFinite(cod) && cod !== 0) {
      const detalle = typeof json.detalle === 'string' ? json.detalle : (json.mensaje || '');
      return { ok: false, motivo: `connekta_${cod}`, detalle: String(detalle).slice(0, 300) };
    }
  }
  if (esObjeto && (json.error || json.Error)) {
    return { ok: false, motivo: 'upstream_error', detalle: String(json.error || json.Error).slice(0, 300) };
  }

  const filas = extraerFilas(json);
  if (!filas) {
    // Sin arreglo de filas pero con total_registros 0 es una consulta vacía legítima.
    const total = esObjeto && json.detalle ? aNumero(json.detalle.total_registros) : null;
    if (total === 0) return { ok: true, unidades: 0, filas: 0 };
    return { ok: false, motivo: 'formato_desconocido' };
  }
  if (filas.length === 0) return { ok: true, unidades: 0, filas: 0 };

  // Se suman todas las filas: un mismo item puede traer varias (lotes, extensiones).
  let total = 0;
  let leidas = 0;
  for (const f of filas) {
    const v = existenciaDeFila(f);
    if (v != null) { total += v; leidas++; }
  }
  if (leidas === 0) return { ok: false, motivo: 'sin_columna_existencia' };

  return { ok: true, unidades: total, filas: leidas };
}

let formaRegistrada = false;

async function consultarExistencia(itemExt) {
  const { plantilla, conniKey, conniToken } = getConfig();
  if (!plantilla || !conniKey || !conniToken) {
    // Se nombra la variable ausente: en Azure estas se configuran aparte del repo
    // (el .env no se versiona), y sin el detalle el diagnóstico es a ciegas.
    const faltan = [
      !plantilla && 'API_EXISTENCIAS',
      !conniKey && 'ConniKey',
      !conniToken && 'ConniToken'
    ].filter(Boolean);
    return { ok: false, motivo: 'config_incompleta', detalle: `faltan: ${faltan.join(', ')}` };
  }

  // La consulta compara item_ext contra una columna int: un código no numérico hace
  // que SQL Server falle con un 500. Se corta antes para no castigar a Connekta.
  if (!/^\d+$/.test(String(itemExt).trim())) {
    return { ok: false, motivo: 'sku_no_numerico' };
  }

  let url;
  try {
    url = construirUrl(plantilla, itemExt);
  } catch (e) {
    return { ok: false, motivo: 'plantilla_invalida', detalle: e.message };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', ConniKey: conniKey, ConniToken: conniToken },
      signal: controller.signal
    });

    const texto = await r.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* se maneja abajo */ }

    if (!r.ok) {
      const detalle = json && (json.detalle || json.mensaje)
        ? String(typeof json.detalle === 'string' ? json.detalle : json.mensaje)
        : texto.slice(0, 200);
      return { ok: false, motivo: `http_${r.status}`, detalle: detalle.slice(0, 300) };
    }
    if (json === null) {
      return { ok: false, motivo: 'respuesta_no_json', detalle: texto.slice(0, 200) };
    }

    const resultado = interpretar(json);

    // Se registra una sola vez la forma real, para detectar si Connekta la cambia.
    if (resultado.ok && resultado.filas > 0 && !formaRegistrada) {
      formaRegistrada = true;
      const filas = extraerFilas(json) || [];
      console.log('[inventario] forma de respuesta Connekta:', JSON.stringify({
        raiz: Object.keys(json),
        fila: filas[0] ? Object.keys(filas[0]) : []
      }));
    }

    return resultado;
  } catch (e) {
    return {
      ok: false,
      motivo: e.name === 'AbortError' ? 'timeout' : 'network_error',
      detalle: e.message
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  consultarExistencia,
  // exportados para pruebas
  construirUrl,
  aNumero,
  interpretar,
  extraerFilas
};
