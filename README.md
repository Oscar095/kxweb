# Cotizador comercial Kos (MVP)

Cotizador de uso diario con **dos perfiles**:

| Perfil | Que hace |
|---|---|
| **Vendedor** | Arma la cotizacion, ingresa precios por linea, ve UB% y alertas, gestiona cliente (incl. nuevo), envia oferta, actualiza seguimiento. **No ve costos.** |
| **Gerente / Aprobador** | Configura umbrales UB%, ve costos y margen $, aprueba/rechaza cotizaciones, consume panel KPIs. |

> **Acceso**: cada persona elige su usuario de la lista y escribe su contraseña (guardada con hash PBKDF2; 5 intentos fallidos bloquean la cuenta 5 minutos). Para que los comerciales entren por internet desde sus computadores, la app se publica en **Azure**: ver **[GUIA_AZURE.md](GUIA_AZURE.md)**. El paquete se arma con `python azure\empaquetar.py` (queda en `dist\`). En Azure el PDF se arma con LibreOffice sobre la misma plantilla Word, y las cargas del ERP se hacen en **Configuración → Datos del ERP**. Alternativa sin nube: un equipo de la oficina con túnel HTTPS ([GUIA_SERVIDOR.md](GUIA_SERVIDOR.md)).

## Comandos

Probado con Python 3.12 en Windows. Desde la carpeta del proyecto (`cotizador/`):

```powershell
# 1. Entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Dependencias
pip install -r requirements.txt

# 3. Generar plantilla Excel + BD inicial (clientes seed + politica)
python -m src.bootstrap_xlsx

# 4. Ejecutar pruebas
pytest -q

# 5. Levantar la app
streamlit run app.py
```

En navegador: `http://localhost:8501`.

**Usuarios y contraseñas**

- Usuarios iniciales: `Carlos Rojas` (gerente, único aprobador), `Elena Acosta` y `Mauricio Pulido` (vendedores).
- La primera vez que arranca, la app los crea con una **contraseña temporal** y la anota en `data/claves_iniciales.txt`. Entrégalas en privado y borra ese archivo.
- Al entrar con la clave temporal, el sistema pide crear una propia (mínimo 8 caracteres, letras y números).
- El gerente crea vendedores, restablece contraseñas y desactiva accesos en **Usuarios**. Cada uno cambia la suya en **Mi cuenta**.
- Recargar la página (F5) cierra la sesión: hay que volver a entrar.

## Estructura

```
cotizador/
  app.py                      # Entry Streamlit (login + router)
  requirements.txt
  README.md
  .gitignore
  data/
    catalogo.xlsx             # generado por bootstrap_xlsx
    cotizador.db              # SQLite (creado al arrancar)
  salidas/                    # PDFs generados
  src/
    config.py                 # paths, politica default, estados
    formato.py                # miles con punto, decimales con coma, %, $
    pricing.py                # UB%, totales, politica de aprobacion
    excel_loader.py           # lee Items/Materiales/Costos/FLETE/Clientes/Politica
    database.py               # SQLite (cotizaciones, lineas, aprobaciones, seguimientos)
    pdf_generator.py          # PDF oferta (SIN costos)
    auth.py                   # usuario en sesion, roles y usuarios iniciales
    usuarios.py               # contraseñas: hash, ingreso, bloqueo, cambio y restablecimiento
    ui.py                     # diseño: estilos, tarjetas, avisos y colores de estado
    bootstrap_xlsx.py         # genera plantilla y semilla BD
    views/
      vendedor.py             # Nueva cotizacion + Mis cotizaciones (sin costos)
      gerente.py              # Aprobaciones + Politica + Todas las cotizaciones
      seguimiento.py          # Post-envio + retroalimentacion
      kpis.py                 # Panel gerencial
  tests/
    test_pricing.py           # UB% + politica de aprobacion
    test_database.py          # Lifecycle + ocultamiento de costo a vendedor
    test_excel_loader.py      # Carga plantilla
    test_formato.py
  docs/
    A_funcional.md
    B_tecnico.md
    E_kpis.md
```

## Costos y productos a cotizar: inventario del ERP

El costo sale **únicamente** del Excel de inventarios del ERP (como `inventarios con costos y movimientos v06oct26.xls`), que también define la lista de productos a cotizar. En la carpeta del cotizador:

```cmd
python -m src.costos_inventario "C:\ruta\inventarios con costos y movimientos.xls"
```

- **Nivel del costo**: Desc. item + Desc. detalle ext. 2 (calibre). El diseño (Desc. normal detalle ext. 1) no cuenta.
- **Costo de cada diseño**: el mayor entre costo promedio y último costo si no difieren más de 25 %. Si difieren (errores de costeo del ERP), el más coherente con los otros diseños del mismo producto + calibre o, si no hay, con el mismo producto en otro calibre o el producto base («VASO 4 OZ» para «VASO 4 OZ LIBRE DE PLASTICO»). Si ni el más cercano queda a menos de 40 % de esa referencia, el diseño no se usa. Sin referencia se toma el mayor y queda para revisar. Si el costo promedio es negativo (error del ERP), se toma el último costo. Los importados (IMP) no se comparan con los fabricados, y solo se comparan productos del mismo tipo.
- **Costo del producto + calibre**: promedio ponderado por existencias de los diseños entre 0,5 y 2 veces la referencia del producto. Si ningún diseño es coherente, se estima con la referencia y queda marcado.
- **Lista de productos**: todo el inventario menos insumos (zuncho) y productos sin movimiento en 2 años.
- **Revisión del gerente**: la columna `REVISAR_COSTO` de la hoja Items marca los costos dudosos (promedio y último que no coinciden sin con qué comparar, costos negativos en el ERP, calibres que no cuadran, costos estimados). La misma nota sale en **Aprobaciones**. Para fijar un costo a mano se usa la hoja `AjustesCosto` (DESCRIPCION, CALIBRE, COSTO, MOTIVO): reemplaza al calculado (`COSTO_INVENTARIO` muestra el calculado) y se conserva en las siguientes cargas.
- **Informe**: cada carga deja `data/auditoria_costos_inventario_<fecha>.xlsx` con el costo anterior y el nuevo por producto, cada diseño con su costo promedio, último costo, costo elegido y motivo, y los productos excluidos de la lista. Tiene costos: no se comparte con vendedores.
- **Flete**: 12 COP por unidad, se suma al costo (hoja FLETE del catálogo).
- **Unidad de empaque**: el vendedor la escribe siempre a mano en cada línea de la cotización (es obligatoria). La columna `Und Empaque` del catálogo queda solo como dato de consulta.
- Se conservan del catálogo anterior los clientes, la referencia de precios de venta y las unidades de empaque. Las versiones de costo previas quedaron en `data/historico/` y no se usan. Reinicia la app después de cargar.

## Clientes, vendedores y referencia de precios: ventas del ERP

Con el detalle de remisiones del ERP (como `costos precios enero sep 26.xlsx`):

```cmd
python -m src.importar_erp "C:\ruta\archivo de ventas del ERP.xlsx"
```

Esta importación **no toca costos ni la lista de productos**.

- **Referencia de precios** (la ven vendedor y gerente al elegir producto y calibre; nunca incluye costos): precio más alto y más bajo con su cliente, unidades y fecha; precio medio del período (ponderado por unidades); promedio de los últimos 3 meses y su variación; rango habitual (la mitad de las ventas); precio promedio de clientes pequeños, medianos y grandes según su volumen mensual; y, si el cliente ya compra la referencia, su último precio y su promedio. No cuentan los precios menores al 40 % de la mediana del producto (muestras, notas o errores).
- **Clientes**: la lista pasa a ser las razones sociales del archivo; los demás quedan inactivos (conservan su historial).
- **Vendedores**: se crean los que son personas, con clave temporal en `data/claves_vendedores_<fecha>.txt`; los que ya no aparecen quedan inactivos. Las cuentas como «EXPORTACIONES KOS» no se crean como usuario.
- Se puede repetir sin duplicar nada. Reinicia la app después de importar.

## Canales y consulta de cotizaciones

- **Canales**: Distri, Horeca, Expo, KA, Medianos y KX (se definen en `src/config.py`). **Expo** es exportación: pide la TRM y la oferta sale en dólares. Las cotizaciones viejas con «Exportaciones» se tratan como Expo; si se edita una con un canal que ya no existe (p. ej. «Otro»), hay que elegir uno vigente.
- **Ver una cotización**: en **Mis cotizaciones** (vendedor, las suyas) y **Cotizaciones** (gerente, todas) cada cotización tiene el botón **Ver**, que abre su ficha: productos, totales, la oferta en PDF tal como la recibe el cliente (verla no la marca como enviada), el correo al ERP y el historial (creación, aprobación, seguimiento y correo al ERP). También se abre desde **Seguimiento** con «Ver cotización».

## PDF de la oferta (formato Kos)

- El PDF se arma con la carta comercial de Kos: `plantillas/cotizacion_kos.docx` (membrete, marca de agua, tabla de precios y condiciones). Word la llena y la exporta a PDF, así que **este PC necesita Microsoft Word**. Sin Word se genera un PDF básico de respaldo.
- La plantilla se puede editar en Word (por ejemplo, los párrafos de planchas o del 15%) siempre que se conserven los marcadores `{{...}}`. Un marcador sin dato borra su línea. Planchas: en pedidos de menos de 100.000 unidades el cliente asume $300.000 pesos por plancha por color.
- La firma sale del perfil de cada vendedor: cargo y celular en **Mi cuenta**.
- Generar con Word toma unos segundos; el PDF se guarda en `salidas/` y se reutiliza mientras la cotización no cambie. Al aprobar, el PDF queda listo para que el vendedor lo descargue al instante.

## Correo para registrar precios en el ERP (marco de control)

- El vendedor propone el precio, el gerente lo aprueba cuando está bajo la política y otra persona lo registra en el ERP.
- **Toda** cotización con precio definido (aprobada por el gerente o dentro de la política) se reporta al ERP: cuando el ejecutivo genera o descarga el PDF, la app le deja listo el correo resumen con un **cuadro de los productos cotizados**: precio unitario, **UB%** (el negativo sale en rojo) y **nivel de autorización** de cada uno («Aprobación comercial / comercial y financiera (quién)» o «No requerida (dentro de política)»). Abajo va el control: quién aprobó, cuándo, nivel, comentario, quién propuso el precio y la política de margen vigente; también el aviso de cliente nuevo si aplica. Nunca incluye costos ni margen en pesos.
- «Abrir correo listo» descarga el correo como archivo de Outlook (.eml, marcado como borrador sin enviar): al abrirlo, Outlook lo muestra con destinatario, asunto y cuadro, listo para darle Enviar. En Chrome o Edge se puede elegir «Abrir siempre archivos de este tipo» para que se abra solo. Si un Outlook no lo abre, «Correo sin formato» abre el mismo correo con el cuadro en texto. Luego «Ya lo envié» deja la constancia (fecha y quién) en la cotización.
- Las ofertas ya enviadas al cliente sin esa constancia aparecen en **Mis cotizaciones › Correo al ERP pendiente** y en un aviso en todas las pantallas del ejecutivo. El gerente ve el estado de cada una en **Cotizaciones** («Correo ERP») y en su ficha.
- Con muchos productos, el «Correo sin formato» puede abrirse cortado (límite de los enlaces mailto); el correo con cuadro no tiene ese límite.
- El responsable del ERP (nombre y correo) se configura en **Configuración**.

## Plantilla Excel (`data/catalogo.xlsx`)

Hojas (todas se generan con `python -m src.bootstrap_xlsx`):

| Hoja | Visibilidad | Columnas obligatorias |
|---|---|---|
| `Items` | gerente / interno | `DESCRIPCION`, `CALIBRE`, `GRAMAJE`, `CINTA`, `Und Empaque`, `GRUPO`, `Material`, `COSTO` (opcional) |
| `Materiales` | **solo gerente** | `Material`, `Costo`, `Desperdicio`, `Costo Real` |
| `Costos` | **solo gerente** | `Grupo`, `MOD`, `CIF` |
| `FLETE` | gerente / interno | `RUBRO`, `PRECIO` |
| `Clientes` | compartida | `nombre`, `contacto`, `ciudad`, `segmento` |
| `Politica` | gerente | `umbral_comercial`, `umbral_financiero` (fracciones, ej. 0.20 = 20%) |
| `LeameCliente` | nota | descripcion |

Cuando un Excel se cargue de nuevo, se respetan defaults documentados si una hoja opcional falta.

## Reglas de margen

```
costo_total = costo_unit + flete_unit
ub_pct = (precio - costo_total) / precio        si precio > 0
```

- `ub_pct < umbral_financiero` (default 10%) -> `Requiere aprobacion comercial y financiera`
- `ub_pct < umbral_comercial` (default 20%) -> `Requiere aprobacion comercial`
- de lo contrario -> OK (sin bloqueo de aprobacion en esa linea)

Los umbrales son editables por el gerente desde la app (`Politica de margen`) y se precargan desde la hoja `Politica`.

## Checklist de pruebas de usuario (manual)

- [ ] Como **vendedor**: crear una cotizacion, ingresar precios, ver UB% y columna Aprobacion.
- [ ] Confirmar que **nunca** aparecen columnas `costo_unit`, `flete_unit`, `costo_total` ni `margen` en sesion vendedor.
- [ ] Crear un cliente nuevo: sin nombre debe fallar; con nombre + datos se crea.
- [ ] Bajar el precio de una linea para forzar UB% bajo -> aparece warning de aprobacion.
- [ ] Generar PDF de oferta: revisar que no menciona costos, tipografia legible.
- [ ] Como **gerente**: ver `Cola de aprobaciones`, ver costos y margen $, aprobar o rechazar.
- [ ] Como **gerente**: ir a `KPIs` y comprobar conteos por estado, win rate, UB% promedio, valor cotizado, margen $, pendientes, dias promedio de cierre, desglose por vendedor.
- [ ] Como **gerente**: ajustar umbrales en `Politica de margen`. Una cotizacion nueva debe respetar los nuevos umbrales.
- [ ] En `Seguimiento` registrar resultado ganada/perdida/en negociacion + categoria de feedback + texto libre.

## Limitaciones del MVP

1. Corre solo en este PC (localhost). Para que los vendedores entren desde sus equipos hay que publicarla con HTTPS; ver `prompt_cotizador_v2.md`.
2. Costo en BD: la columna `costo_unit` se persiste; la UI vendedor la filtra. En produccion, conviene mover costo a una tabla separada o vista solo visible para `rol=gerente` con politicas de fila.
3. PDF logo: no se incluye logotipo por defecto. Agregar en `src/pdf_generator.py` (`logo_path`).
4. Sin envio real por correo / WhatsApp: el PDF se descarga desde la app.
5. Excel: cambios deben re-cargarse reiniciando la app (cache simple en `st.session_state`).

## Siguiente fase sugerida

- Auth real + roles por usuario.
- Maestro de productos editable desde la UI (con auditoria) en lugar del Excel.
- Aprobacion por linea (hoy es por cotizacion).
- Enviar oferta por correo / WhatsApp desde la app con plantilla configurable.
- Sincronizacion con ERP / cartera para validar credito y disponibilidad.
