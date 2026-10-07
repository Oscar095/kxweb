"""Correo al responsable de registrar precios en el ERP (marco de control).

Separacion de funciones: el vendedor propone el precio, el gerente lo aprueba
cuando esta bajo la politica de margen y otra persona lo registra en el ERP.
Todo precio que sale al cliente se registra: al generar o descargar el PDF, el
ejecutivo comercial recibe el correo listo para enviar, con la evidencia de cada
precio (aprobado por gerencia, con quien y cuando, o dentro de la politica). La
app guarda cuando y quien lo envio; las que faltan quedan pendientes.

El correo lleva un cuadro con cada producto, su precio, su UB% y el nivel de
autorizacion dado. Nunca incluye costos ni margen en pesos.
"""
from __future__ import annotations

import html as html_lib
from email import policy as email_policy
from email.message import EmailMessage
from urllib.parse import quote

from .config import es_exportacion
from .formato import fmt_miles, fmt_porcentaje
from .plantilla_word import fecha_vigencia
from .pricing import APROB_COMERCIAL_FIN

PARAM_ERP_NOMBRE = "erp_responsable_nombre"
PARAM_ERP_CORREO = "erp_responsable_correo"

ORIGEN_GERENCIA = "gerencia"  # requirio aprobacion y el gerente la dio
ORIGEN_POLITICA = "politica"  # todos los precios cumplen la politica de margen
_SIN_PRECIO_DEFINIDO = {"borrador", "pendiente_aprobacion", "rechazada"}
# La oferta ya salio al cliente: desde aqui el correo al ERP queda pendiente hasta enviarlo.
ESTADOS_OFERTA_ENVIADA = {"enviada", "en_negociacion", "ganada"}
CORREO_ENVIADO = "enviado"
CORREO_PENDIENTE = "pendiente"


def origen_precios(estado: str, requiere_aprobacion: bool, tiene_aprobacion: bool) -> str | None:
    """Quien dio el visto bueno al precio, o None si aun no hay precio para el ERP.

    Un borrador, una cotizacion en aprobacion o una rechazada todavia no tienen
    precio definitivo; tampoco una que requeria aprobacion y no la tiene.
    """
    if estado in _SIN_PRECIO_DEFINIDO:
        return None
    if not requiere_aprobacion:
        return ORIGEN_POLITICA
    return ORIGEN_GERENCIA if tiene_aprobacion else None


def estado_correo(estado: str, origen: str | None, enviado_en: str | None) -> str:
    """'enviado', 'pendiente' (oferta enviada con precio definido y sin correo) o '' (aun no aplica)."""
    if enviado_en:
        return CORREO_ENVIADO
    if origen and estado in ESTADOS_OFERTA_ENVIADA:
        return CORREO_PENDIENTE
    return ""


def _precio(valor: float) -> str:
    valor = float(valor or 0)
    return f"$ {fmt_miles(valor, 0 if valor.is_integer() else 2)}"


def _autorizacion(linea: dict, decision: dict) -> str:
    """Nivel de autorizacion dado al precio de la linea."""
    requerida = (linea.get("aprobacion_txt") or "").strip()
    if not requerida:
        return "No requerida (dentro de política)"
    nivel = "comercial y financiera" if requerida == APROB_COMERCIAL_FIN else "comercial"
    quien = decision.get("usuario")
    return f"Aprobación {nivel}" + (f" ({quien})" if quien else "")


def _texto_politica(politica) -> str:
    uc, uf = fmt_porcentaje(politica.umbral_comercial, 0), fmt_porcentaje(politica.umbral_financiero, 0)
    return (f"Política de margen vigente: UB desde {uc} no requiere aprobación; entre {uf} y {uc}, "
            f"aprobación comercial; menos de {uf}, comercial y financiera")


def armar_correo(
    cot: dict,
    lineas: list[dict],
    decision: dict | None,
    responsable: dict | None,
    firmante: str,
    politica=None,
) -> dict:
    """Devuelve {para, asunto, cuerpo, mailto, html, filas}.

    cot: cotizacion con datos del cliente (database.obtener_cotizacion).
    lineas: producto, calibre, impreso, empaque, cantidad_mes, precio, ub_pct, aprobacion_txt.
    decision: ultima aprobacion {usuario, creado_en, motivo}.
    responsable: {nombre, correo} de quien registra en el ERP.
    politica: PoliticaMargen vigente (opcional, se cita en el control).

    El cuadro de productos lleva precio, UB% y nivel de autorizacion de cada uno.
    Nunca lleva costos ni margen en pesos.
    """
    responsable = responsable or {}
    decision = decision or {}
    para = (responsable.get("correo") or "").strip()
    nombre_resp = (responsable.get("nombre") or "").strip()
    cliente = (cot.get("cliente_nombre") or "").strip()
    es_nuevo = int(cot.get("cliente_es_nuevo") or 0) == 1
    trm = float(cot.get("trm") or 0)
    es_usd = es_exportacion(cot.get("canal")) and trm > 0

    asunto = f"Registro de precios en ERP - {cot['codigo']} - {cliente}"
    saludo = f"Hola{' ' + nombre_resp.split()[0] if nombre_resp else ''},"

    datos = [
        f"Cotización: {cot['codigo']} del {str(cot['fecha'])[:10]}",
        f"Cliente: {cliente} ({'cliente nuevo' if es_nuevo else 'cliente existente'})"
        + (f" - {cot['cliente_ciudad']}" if (cot.get("cliente_ciudad") or "").strip() else ""),
        f"Vendedor: {cot.get('vendedor', '')}"
        + (f" (en el ERP: {cot['vendedor_erp']})" if (cot.get("vendedor_erp") or "").strip() else ""),
        f"Canal: {cot.get('canal') or '-'} - Pago: {cot.get('condiciones_pago') or '-'} - "
        f"Oferta vigente hasta {fecha_vigencia(cot['fecha'], cot.get('vigencia_dias') or 15)}",
    ]
    if es_usd:
        datos.append(f"Oferta en dólares con TRM {fmt_miles(trm, 2)} (precio en COP y en US$)")
    flete = float(cot.get("flete_adicional") or 0)
    if flete > 0:
        datos.append(f"Flete adicional: {_precio(flete)}")

    filas = []
    for i, l in enumerate(lineas, start=1):
        precio = float(l.get("precio") or 0)
        ub = l.get("ub_pct")
        filas.append({
            "n": i,
            "producto": str(l.get("producto") or ""),
            "calibre": str(l.get("calibre") or ""),
            "impresion": "Impreso" if str(l.get("impreso") or "").lower() == "si" else "Sin impresión",
            "empaque": fmt_miles(l.get("empaque")),
            "cantidad": fmt_miles(l.get("cantidad_mes")),
            "precio": _precio(precio) + (f" (US$ {fmt_miles(precio / trm, 3)})" if es_usd else ""),
            "ub": fmt_porcentaje(ub, 1) if ub is not None else "-",
            "autorizacion": _autorizacion(l, decision),
        })
    # Version de texto del cuadro (para el enlace mailto, que no admite formato)
    precios = [
        f"{f['n']}. {f['producto']} {f['calibre']} | {f['impresion']} | Empaque {f['empaque']} | "
        f"{f['cantidad']} und/mes | {f['precio']} | UB {f['ub']} | {f['autorizacion']}"
        for f in filas
    ]

    textos = {(l.get("aprobacion_txt") or "").strip() for l in lineas} - {""}
    if textos:
        nivel = "Comercial y financiera" if APROB_COMERCIAL_FIN in textos else "Comercial"
        cuando = (decision.get("creado_en") or "").replace("T", " ")[:16]
        mixto = any(not (l.get("aprobacion_txt") or "").strip() for l in lineas)
        intro = ("Los que requerían aprobación los aprobó gerencia; los demás cumplen la política de margen."
                 if mixto else "Fueron aprobados por gerencia según la política de margen.")
        control = [
            f"Aprobado por: {decision.get('usuario') or 'pendiente'}" + (f" el {cuando}" if cuando else ""),
            f"Nivel de aprobación requerido: {nivel}",
        ]
        if (decision.get("motivo") or "").strip():
            control.append(f"Comentario del aprobador: {decision['motivo'].strip()}")
        control.append(f"Precio propuesto por: {cot.get('vendedor', '')}")
    else:
        intro = "Cumplen la política de margen vigente, por lo que no requirieron aprobación de gerencia."
        control = [
            "Aprobación de gerencia: no requerida (todos los precios cumplen la política de margen)",
            f"Precio definido por: {cot.get('vendedor', '')}",
        ]
    if politica is not None:
        control.append(_texto_politica(politica))
    nuevo = ""
    if es_nuevo:
        contacto = (cot.get("cliente_contacto") or "").strip()
        nuevo = ("CLIENTE NUEVO: crea el tercero en el ERP antes de cargar los precios"
                 + (f" (contacto: {contacto})." if contacto else "."))
    cierre = "Cuando termines, responde este correo con la fecha de registro en el ERP para cerrar el control."
    pedido = f"Por favor registra en el ERP los siguientes precios. {intro}"

    partes = [saludo, "", pedido, "", "DATOS DE LA COTIZACIÓN", *[f"- {d}" for d in datos], "",
              "PRODUCTOS COTIZADOS (precio por unidad, UB% y autorización)", *precios]
    if nuevo:
        partes += ["", nuevo]
    partes += ["", "CONTROL", *[f"- {c}" for c in control], "", cierre, "", "Gracias,", firmante]
    cuerpo = "\n".join(partes)
    mailto = f"mailto:{quote(para)}?subject={quote(asunto)}&body={quote(cuerpo)}"
    html = _html(saludo, pedido, datos, filas, nuevo, control, cierre, firmante)
    return {"para": para, "asunto": asunto, "cuerpo": cuerpo, "mailto": mailto, "html": html, "filas": filas}


_COLUMNAS = (("n", "#"), ("producto", "Producto"), ("calibre", "Calibre"), ("impresion", "Impresión"),
             ("empaque", "Empaque"), ("cantidad", "Cantidad/mes"), ("precio", "Precio unitario"),
             ("ub", "UB%"), ("autorizacion", "Nivel de autorización"))
_A_LA_DERECHA = {"empaque", "cantidad", "precio", "ub"}


def _html(saludo, pedido, datos, filas, nuevo, control, cierre, firmante) -> str:
    """Mismo correo con el cuadro de productos como tabla (para Outlook)."""
    e = html_lib.escape
    celda = "border:1px solid #cbd5e1;padding:5px 9px;"
    encabezado = "".join(
        f"<th style='{celda}background:#0f2d4a;color:#ffffff;text-align:left'>{e(t)}</th>" for _, t in _COLUMNAS)
    def estilo(k: str, valor: str) -> str:
        s = f"{celda}text-align:{'right' if k in _A_LA_DERECHA else 'left'};"
        if k == "ub" and valor.startswith("-"):
            s += "color:#b42318;font-weight:bold;"  # margen negativo: que salte a la vista
        return s

    cuerpo_tabla = "".join(
        "<tr>" + "".join(f"<td style='{estilo(k, str(f[k]))}'>{e(str(f[k]))}</td>" for k, _ in _COLUMNAS) + "</tr>"
        for f in filas
    )
    lista = lambda items: "<br>".join(e(i) for i in items)  # noqa: E731
    return (
        "<div style=\"font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2937\">"
        f"<p>{e(saludo)}</p><p>{e(pedido)}</p>"
        f"<p><b>Datos de la cotización</b><br>{lista(datos)}</p>"
        "<p><b>Productos cotizados</b></p>"
        f"<table style='border-collapse:collapse;font-size:10pt'><tr>{encabezado}</tr>{cuerpo_tabla}</table>"
        + (f"<p><b>{e(nuevo)}</b></p>" if nuevo else "")
        + f"<p><b>Control</b><br>{lista(control)}</p>"
        f"<p>{e(cierre)}</p><p>Gracias,<br>{e(firmante)}</p></div>"
    )


def correo_eml(correo: dict) -> bytes:
    """Archivo .eml que Outlook abre como borrador listo para enviar (X-Unsent), con el
    cuadro de productos en formato y la version de texto como respaldo."""
    msg = EmailMessage()
    if correo.get("para"):
        msg["To"] = correo["para"]
    msg["Subject"] = correo["asunto"]
    msg["X-Unsent"] = "1"
    msg.set_content(correo["cuerpo"])
    msg.add_alternative(correo["html"], subtype="html")
    return msg.as_bytes(policy=email_policy.SMTP)
