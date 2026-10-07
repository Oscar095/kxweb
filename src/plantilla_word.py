"""Oferta comercial en PDF con la plantilla Word de Kos.

La plantilla (plantillas/cotizacion_kos.docx) es la carta comercial de Kos con
marcadores {{...}}. Se llena con Microsoft Word (automatizacion COM) y se exporta
a PDF, asi el resultado conserva membrete, marca de agua y estilo del formato.

Marcadores (un marcador sin valor elimina su parrafo):
    {{FECHA}} {{CLIENTE}} {{CONTACTO}} {{CARGO_CONTACTO}} {{CIUDAD_CLIENTE}}
    {{ASUNTO}} {{SALUDO}} {{TABLA}} {{CONDICIONES_PAGO}} {{VIGENCIA}} {{FLETE}}
    {{ENTREGA}} {{OBSERVACIONES}} {{VENDEDOR}} {{CARGO_VENDEDOR}} {{CELULAR_VENDEDOR}}

La plantilla se puede editar en Word (por ejemplo, los parrafos de condiciones
fijas) siempre que se conserven los marcadores.
"""
from __future__ import annotations

import re
import sys
import threading
from datetime import date, datetime, timedelta
from pathlib import Path

from .config import ROOT_DIR, es_exportacion
from .formato import fmt_miles

PLANTILLA_DOCX = ROOT_DIR / "plantillas" / "cotizacion_kos.docx"
AZUL_TABLA = "#548DD4"  # azul de la tabla del formato original
ANCHOS_TABLA = (128, 52, 52, 56, 50, 50, 54)  # puntos; suman el ancho util de la carta (442)
MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)
_FAMILIAS = {
    "VASO": "Vasos", "CONT": "Contenedores", "TAPA": "Tapas", "PLATO": "Platos",
    "ANILLO": "Anillos", "ANILLOS": "Anillos", "BOWL": "Bowls", "CAJA": "Cajas",
    "PORTA": "Portacomidas", "PORTAVASOS": "Portavasos", "SALSERA": "Salseras", "KIT": "Kits",
}
_ABREVIATURAS = {
    "CONT": "contenedor", "DP": "doble pared", "IMP": "impreso",
    "KX": "KX", "PET": "PET", "MSP": "MSP", "CAB": "CAB",
}
_TRATAMIENTOS = {"sr", "sr.", "sra", "sra.", "srta", "srta.", "dr", "dr.", "dra", "dra.", "ing", "ing."}
_TEXTO_FOB = ("Flete Buenaventura incluido en el precio, Termino de negociación "
              "FOB/Puerto de Buenaventura")

_WD_FORMAT_PDF = 17
_WD_FORMAT_DOCX = 16
_LOCK = threading.Lock()  # Word no admite automatizacion concurrente segura


# ---------------------------------------------------------------------------
# Datos de la carta (funciones puras, sin Word)
# ---------------------------------------------------------------------------


def _a_fecha(valor) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return datetime.fromisoformat(str(valor)[:19]).date()


def fecha_carta(valor) -> str:
    """'octubre 2 de 2026', como en el formato."""
    d = _a_fecha(valor)
    return f"{MESES[d.month - 1]} {d.day} de {d.year}"


def fecha_vigencia(valor, dias: int) -> str:
    """Fecha limite de la oferta: 'octubre 17/2026'."""
    d = _a_fecha(valor) + timedelta(days=int(dias or 0))
    return f"{MESES[d.month - 1]} {d.day}/{d.year}"


def calibre_carta(calibre: str) -> str:
    """K016 o C/0.016 (ERP) -> C/0,016, como se escribe en las ofertas."""
    texto = (calibre or "").strip()
    m = re.fullmatch(r"(?:[Kk]|[Cc]/0[.,])(\d{3})", texto)
    if m:
        return f"C/0,{m.group(1)}"
    return "N/A" if texto.upper() in ("", "NO APLICA") else texto


def referencia_carta(producto: str) -> str:
    """'VASO 16 OZ' -> 'Vaso 16 oz'; expande abreviaturas del catalogo."""
    palabras = [_ABREVIATURAS.get(p.upper(), p.lower()) for p in (producto or "").split()]
    texto = " ".join(palabras)
    return texto[:1].upper() + texto[1:]


def asunto(lineas: list[dict]) -> str:
    familias: list[str] = []
    for l in lineas:
        clave = (str(l.get("producto") or "").split() or [""])[0].upper()
        familia = _FAMILIAS.get(clave, "Productos")
        if familia not in familias:
            familias.append(familia)
    if not familias:
        familias = ["Productos"]
    texto = familias[0] if len(familias) == 1 else ", ".join(familias[:-1]) + " y " + familias[-1]
    return f"Propuesta Comercial {texto}"


def es_nombre_persona(texto: str) -> bool:
    t = (texto or "").strip()
    return bool(t) and "@" not in t and not any(c.isdigit() for c in t) and any(c.isalpha() for c in t)


def saludo(contacto: str) -> str:
    if not es_nombre_persona(contacto):
        return "Estimados señores,"
    palabras = [p for p in contacto.split() if p.lower() not in _TRATAMIENTOS]
    return f"Estimado(a) {palabras[0]}," if palabras else "Estimados señores,"


def _frase(texto: str) -> str:
    texto = " ".join((texto or "").split())
    return texto if not texto or texto[-1] in ".!?" else texto + "."


def datos_oferta(cot: dict, lineas: list[dict], vendedor: dict | None = None) -> dict:
    """Todo lo que se escribe en la carta. Nunca incluye costos ni margen."""
    trm = float(cot.get("trm") or 0)
    es_usd = es_exportacion(cot.get("canal")) and trm > 0
    moneda = "US$" if es_usd else "COP"

    def en_moneda(valor: float) -> float:
        return float(valor or 0) / trm if es_usd else float(valor or 0)

    contacto = (cot.get("cliente_contacto") or "").strip()
    ciudad = (cot.get("cliente_ciudad") or "").strip()
    flete = float(cot.get("flete_adicional") or 0)
    if flete > 0:
        monto = fmt_miles(en_moneda(flete), 2 if es_usd else 0)
        texto_flete = f"Flete: {moneda} {monto} adicional al valor de los productos."
    elif es_usd:
        texto_flete = _TEXTO_FOB
    else:
        texto_flete = "Flete incluido en el precio."

    vendedor = vendedor or {}
    nombre_vendedor = (vendedor.get("nombre") or cot.get("vendedor") or "").strip()
    cargo = (vendedor.get("cargo") or "").strip()
    celular = (vendedor.get("celular") or "").strip()

    marcadores = {
        "{{FECHA}}": fecha_carta(cot["fecha"]),
        "{{CLIENTE}}": (cot.get("cliente_nombre") or "").strip().upper(),
        "{{CONTACTO}}": (f"Atn.: {contacto}" if es_nombre_persona(contacto) else f"Contacto: {contacto}")
        if contacto else None,
        "{{CARGO_CONTACTO}}": None,
        "{{CIUDAD_CLIENTE}}": _frase(ciudad) or None,
        "{{ASUNTO}}": asunto(lineas),
        "{{SALUDO}}": saludo(contacto),
        "{{CONDICIONES_PAGO}}": _frase(f"Condiciones de pago: {cot['condiciones_pago']}")
        if (cot.get("condiciones_pago") or "").strip() else None,
        "{{VIGENCIA}}": fecha_vigencia(cot["fecha"], cot.get("vigencia_dias") or 15),
        "{{FLETE}}": texto_flete,
        "{{ENTREGA}}": _frase(f"Tiempo de entrega: {cot['tiempo_entrega']}")
        if (cot.get("tiempo_entrega") or "").strip() else None,
        "{{OBSERVACIONES}}": _frase(f"Observaciones: {cot['notas']}")
        if (cot.get("notas") or "").strip() else None,
        "{{VENDEDOR}}": f"{nombre_vendedor.upper()}." if nombre_vendedor else None,
        "{{CARGO_VENDEDOR}}": cargo or None,
        "{{CELULAR_VENDEDOR}}": f"Celular {celular}" if celular else None,
    }

    filas = []
    for l in lineas:
        precio = en_moneda(l.get("precio"))
        empaque = int(l.get("empaque") or 0)
        filas.append([
            referencia_carta(l.get("producto")),
            calibre_carta(l.get("calibre")),
            "Impreso" if str(l.get("impreso") or "").lower() == "si" else "Sin impresión",
            fmt_miles(l.get("cantidad_mes")),
            fmt_miles(empaque) if empaque else "—",
            fmt_miles(precio, 3 if es_usd else 2),
            fmt_miles(precio * empaque, 2 if es_usd else 0) if empaque else "—",
        ])
    mes = MESES[_a_fecha(cot["fecha"]).month - 1].upper()
    tabla = {
        "titulo": f"PRECIOS {mes} {(cot.get('cliente_nombre') or '').strip().upper()}",
        "encabezados": [
            "REFERENCIA", "CALIBRE", "IMPRESIÓN", "Cantidad Mensual", "Unidad de Empaque",
            f"Valor unit {moneda}", f"Valor Caja {moneda}",
        ],
        "filas": filas,
    }
    return {"marcadores": marcadores, "tabla": tabla}


# ---------------------------------------------------------------------------
# Word (automatizacion COM)
# ---------------------------------------------------------------------------


def disponible() -> bool:
    """Hay plantilla y estamos en Windows con pywin32 (Word se valida al abrirlo)."""
    if sys.platform != "win32" or not PLANTILLA_DOCX.exists():
        return False
    try:
        import win32com.client  # noqa: F401
    except ImportError:
        return False
    return True


def _color_word(hex_color: str) -> int:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return r + g * 256 + b * 65536  # Word usa BGR


class _Word:
    """Abre Word sin interfaz y garantiza cerrarlo."""

    def __enter__(self):
        import pythoncom
        import win32com.client

        _LOCK.acquire()
        pythoncom.CoInitialize()
        try:
            self.app = win32com.client.DispatchEx("Word.Application")
            self.app.Visible = False
            self.app.DisplayAlerts = 0
        except Exception:
            pythoncom.CoUninitialize()
            _LOCK.release()
            raise
        return self.app

    def __exit__(self, *exc):
        import pythoncom

        try:
            self.app.Quit(False)
        finally:
            del self.app  # soltar la referencia antes de cerrar COM
            pythoncom.CoUninitialize()
            _LOCK.release()
        return False


def _buscar(doc, texto: str):
    """Rango con la primera aparicion de `texto`, o None."""
    rango = doc.Content
    hallado = rango.Find.Execute(texto, True, False, False, False, False, True, 0)
    return rango if hallado else None


def _poner(doc, marcador: str, valor: str | None) -> None:
    rango = _buscar(doc, marcador)
    while rango is not None:
        if valor:
            rango.Text = valor
        else:
            rango.Paragraphs(1).Range.Delete()
        rango = _buscar(doc, marcador)


def _insertar_tabla(doc, tabla: dict) -> None:
    rango = _buscar(doc, "{{TABLA}}")
    if rango is None:
        return
    rango.Text = ""
    filas = tabla["filas"]
    t = doc.Tables.Add(rango, len(filas) + 2, len(tabla["encabezados"]))
    t.Borders.Enable = True
    for i, ancho in enumerate(ANCHOS_TABLA, start=1):
        t.Columns(i).Width = ancho
    t.Rows.Alignment = 1  # centrada
    todo = t.Range
    todo.Font.Name = "Arial"
    todo.Font.Size = 7.5
    todo.Font.Bold = True
    todo.ParagraphFormat.Alignment = 1
    todo.ParagraphFormat.SpaceBefore = 0
    todo.ParagraphFormat.SpaceAfter = 0
    todo.ParagraphFormat.LineSpacingRule = 0
    todo.Cells.VerticalAlignment = 1

    azul = _color_word(AZUL_TABLA)
    for j, texto in enumerate(tabla["encabezados"], start=1):
        t.Cell(2, j).Range.Text = texto
    t.Rows(2).Shading.BackgroundPatternColor = azul
    t.Rows(2).Range.Font.Color = _color_word("#FFFFFF")
    for i, fila in enumerate(filas, start=3):
        for j, texto in enumerate(fila, start=1):
            t.Cell(i, j).Range.Text = texto

    t.Rows(1).Shading.BackgroundPatternColor = azul
    t.Rows(1).Cells.Merge()
    t.Cell(1, 1).Range.Text = tabla["titulo"]
    t.Cell(1, 1).Range.Font.Size = 11
    t.Rows(1).HeadingFormat = True
    t.Rows(2).HeadingFormat = True

    # Word agrega un parrafo vacio tras la tabla; la carta ya trae uno de separacion.
    siguiente = t.Range.Next(4, 1)  # 4 = wdParagraph
    if siguiente is not None and not siguiente.Text.strip():
        despues = siguiente.Next(4, 1)
        if despues is not None and not despues.Text.strip():
            siguiente.Delete()


def generar_pdf(datos: dict, salida: Path | str, plantilla: Path | str = PLANTILLA_DOCX) -> Path:
    """Llena la plantilla con `datos` (de datos_oferta) y la exporta a PDF."""
    salida = Path(salida).resolve()
    salida.parent.mkdir(parents=True, exist_ok=True)
    with _Word() as word:
        doc = word.Documents.Open(str(Path(plantilla).resolve()), ReadOnly=True, AddToRecentFiles=False)
        try:
            for marcador, valor in datos["marcadores"].items():
                _poner(doc, marcador, valor)
            _insertar_tabla(doc, datos["tabla"])
            doc.SaveAs2(str(salida), _WD_FORMAT_PDF)
        finally:
            doc.Close(False)
            del doc  # soltar la referencia antes de cerrar Word
    return salida


# ---------------------------------------------------------------------------
# Preparacion de la plantilla (se hizo una vez a partir de la carta original)
# ---------------------------------------------------------------------------

_REEMPLAZOS_PLANTILLA = (
    ("Yumbo, marzo 13 de 2025", "Yumbo, {{FECHA}}"),
    ("ANIBAL PASCUAL PERNA", "{{CLIENTE}}"),
    ("Sr.: Anibal Perna", "{{CONTACTO}}"),
    ("Gerente", "{{CARGO_CONTACTO}}"),
    ("Panama.", "{{CIUDAD_CLIENTE}}"),
    ("Propuesta Comercial Vasos Bebida Fria", "{{ASUNTO}}"),
    ("Estimado Aníbal,", "{{SALUDO}}"),
    ("Le agradecemos abonar el 50% del valor del pedido para iniciar el proceso de producción.",
     "{{CONDICIONES_PAGO}}"),
    ("marzo 30/2025", "{{VIGENCIA}}"),
    (_TEXTO_FOB, "{{FLETE}}\r{{ENTREGA}}\r{{OBSERVACIONES}}"),
    ("LUIFER CASTELLANOS LÓPEZ.", "{{VENDEDOR}}"),
    ("Representante de Ventas Internacionales", "{{CARGO_VENDEDOR}}"),
    ("Celular +(57) 322 675 19 55", "{{CELULAR_VENDEDOR}}"),
)


def preparar_plantilla(origen: Path | str, destino: Path | str = PLANTILLA_DOCX) -> Path:
    """Convierte una carta comercial real en plantilla con marcadores.

    - Reemplaza los datos variables por marcadores.
    - Cambia la tabla pegada como imagen por {{TABLA}}.
    - Quita la firma manuscrita (es de una persona especifica).
    """
    destino = Path(destino).resolve()
    destino.parent.mkdir(parents=True, exist_ok=True)
    with _Word() as word:
        doc = word.Documents.Open(str(Path(origen).resolve()), ReadOnly=True, AddToRecentFiles=False)
        try:
            for viejo, nuevo in _REEMPLAZOS_PLANTILLA:
                rango = _buscar(doc, viejo)
                if rango is None:
                    raise ValueError(f"No se encontró en la carta: {viejo!r}")
                rango.Text = nuevo
            if doc.InlineShapes.Count != 2:
                raise ValueError("Se esperaban 2 imágenes en el cuerpo (tabla y firma).")
            doc.InlineShapes(1).Range.Text = "{{TABLA}}"
            doc.InlineShapes(1).Delete()  # firma manuscrita
            doc.SaveAs2(str(destino), _WD_FORMAT_DOCX)
        finally:
            doc.Close(False)
            del doc
    return destino
