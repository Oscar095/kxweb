"""Generador de PDF de oferta al cliente.

Motor principal: la plantilla Word de Kos, que produce la carta comercial oficial.
Se llena con Microsoft Word en Windows (plantilla_word.py) o, en servidores sin
Word como Azure, con LibreOffice (plantilla_libreoffice.py). Si no hay ninguno se
usa un PDF basico con reportlab.
Variable COTIZADOR_PDF_MOTOR: auto (por defecto) | word | libreoffice | basico.

Reglas de oro:
    - NO incluir costo_unit, UB% ni columnas internas.
    - Tipografia legible (>= 10 pt cuerpo en tablas, >= 12 pt textos).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from . import plantilla_libreoffice, plantilla_word
from .config import SALIDAS_DIR, es_exportacion
from .formato import fmt_miles, fmt_moneda, fmt_usd

_LOG = logging.getLogger(__name__)


def _styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="TituloCot",
            parent=base["Title"],
            fontSize=18,
            spaceAfter=8,
            textColor=colors.HexColor("#0a3d62"),
        )
    )
    base.add(
        ParagraphStyle(
            name="Encabezado",
            parent=base["Normal"],
            fontSize=11,
            leading=14,
        )
    )
    base.add(
        ParagraphStyle(
            name="Pequeno",
            parent=base["Normal"],
            fontSize=9,
            leading=11,
            textColor=colors.grey,
        )
    )
    base.add(
        ParagraphStyle(
            name="Terminos",
            parent=base["Normal"],
            fontSize=10,
            leading=13,
        )
    )
    return base


def generar_pdf_oferta(
    cot: dict,
    lineas: Iterable[dict],
    salida: Path | None = None,
    empresa: str = "Kos Colombia S.A.S.",
    logo_path: Path | None = None,
    vendedor: dict | None = None,
    motor: str | None = None,
) -> Path:
    """Genera el PDF de oferta para el cliente (plantilla Word o, si no hay, basico).

    `vendedor`: {nombre, cargo, celular} para la firma de la carta.
    """
    lineas = list(lineas)
    salida = Path(salida or SALIDAS_DIR / f"oferta_{cot['codigo']}.pdf")
    motor = (motor or os.environ.get("COTIZADOR_PDF_MOTOR") or "auto").lower()
    # Plantilla de Kos: con Word (Windows) o, sin Word, con LibreOffice (Linux, Azure).
    if motor in ("auto", "word") and plantilla_word.disponible():
        generador = plantilla_word.generar_pdf
    elif motor in ("auto", "libreoffice") and plantilla_libreoffice.disponible():
        generador = plantilla_libreoffice.generar_pdf
    elif motor in ("word", "libreoffice"):
        raise RuntimeError(f"El motor de PDF «{motor}» no está disponible en este equipo.")
    else:
        generador = None
    if generador is not None:
        try:
            return generador(plantilla_word.datos_oferta(cot, lineas, vendedor), salida)
        except Exception:
            if motor != "auto":
                raise
            _LOG.exception("No se pudo usar la plantilla de Kos; se genera el PDF basico.")
    return _generar_pdf_basico(cot, lineas, salida, empresa)


def _generar_pdf_basico(
    cot: dict,
    lineas: Iterable[dict],
    salida: Path | None = None,
    empresa: str = "Kos Colombia S.A.S.",
) -> Path:
    """PDF de respaldo con reportlab (sin plantilla).

    `cot` debe tener: codigo, fecha, vendedor, cliente_nombre, cliente_contacto,
    cliente_ciudad, canal, condiciones_pago, vigencia_dias, tiempo_entrega, notas.

    `lineas` debe tener: producto, calibre, impreso, empaque, cantidad_mes, precio.
    """
    salida = salida or SALIDAS_DIR / f"oferta_{cot['codigo']}.pdf"
    salida.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(salida),
        pagesize=LETTER,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"Cotizacion {cot['codigo']}",
        author=empresa,
    )
    st = _styles()
    elems = []

    elems.append(Paragraph(empresa, st["TituloCot"]))
    elems.append(
        Paragraph(
            f"<b>Cotizacion:</b> {cot['codigo']} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>Fecha:</b> {cot['fecha'][:10]} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>Vigencia:</b> {cot.get('vigencia_dias', 15)} dias",
            st["Encabezado"],
        )
    )
    elems.append(Spacer(1, 6))

    cliente_lineas = [
        f"<b>Cliente:</b> {cot.get('cliente_nombre','')}",
    ]
    if cot.get("cliente_contacto"):
        cliente_lineas.append(f"<b>Contacto:</b> {cot['cliente_contacto']}")
    if cot.get("cliente_ciudad"):
        cliente_lineas.append(f"<b>Ciudad:</b> {cot['cliente_ciudad']}")
    if cot.get("canal"):
        cliente_lineas.append(f"<b>Canal:</b> {cot['canal']}")
    if cot.get("vendedor"):
        cliente_lineas.append(f"<b>Ejecutivo:</b> {cot['vendedor']}")
    # Modo USD: solo en el canal de exportacion (Expo) y con TRM > 0.
    trm = float(cot.get("trm") or 0)
    es_export_usd = es_exportacion(cot.get("canal")) and trm > 0

    def _fmt_precio(v: float) -> str:
        if es_export_usd:
            return fmt_usd(v / trm, 3)
        return fmt_moneda(v, 0)

    def _fmt_total(v: float) -> str:
        if es_export_usd:
            return fmt_usd(v / trm, 3)
        return fmt_moneda(v, 0)

    if es_export_usd:
        elems.append(
            Paragraph(
                f"<b>TRM aplicada:</b> {fmt_miles(trm, 2)} COP/USD &nbsp; "
                f"<i>(Oferta expresada en dolares americanos)</i>",
                st["Encabezado"],
            )
        )
    elems.append(Paragraph("<br/>".join(cliente_lineas), st["Encabezado"]))
    elems.append(Spacer(1, 10))

    # Tabla de lineas (sin costos)
    header = ["#", "Producto", "Calibre", "Impreso", "Empaque", "Cantidad mes", "Precio", "Subtotal"]
    rows = [header]
    subtotal_lineas = 0.0
    for i, l in enumerate(list(lineas), start=1):
        precio = float(l.get("precio") or 0)
        cant = float(l.get("cantidad_mes") or 0)
        subtotal = precio * cant
        subtotal_lineas += subtotal
        rows.append(
            [
                str(i),
                str(l.get("producto", "")),
                str(l.get("calibre", "") or ""),
                str(l.get("impreso", "") or ""),
                fmt_miles(l.get("empaque")),
                fmt_miles(cant),
                _fmt_precio(precio),
                _fmt_total(subtotal),
            ]
        )

    flete_adicional = float(cot.get("flete_adicional") or 0)
    rows.append(["", "", "", "", "", "", "Subtotal lineas", _fmt_total(subtotal_lineas)])
    if flete_adicional > 0:
        rows.append(["", "", "", "", "", "", "Flete adicional", _fmt_total(flete_adicional)])
    total_final = subtotal_lineas + flete_adicional
    rows.append(["", "", "", "", "", "", "Total oferta", _fmt_total(total_final)])

    table = Table(
        rows,
        repeatRows=1,
        colWidths=[10 * mm, 42 * mm, 18 * mm, 18 * mm, 22 * mm, 26 * mm, 24 * mm, 28 * mm],
    )
    filas_totales = 3 if flete_adicional > 0 else 2  # subtotal (+ flete) + total final
    inicio_totales = len(rows) - filas_totales  # primera fila de subtotal
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0a3d62")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("FONTSIZE", (0, 1), (-1, -1), 10),
                ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, inicio_totales - 1), [colors.whitesmoke, colors.white]),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.black),
                ("GRID", (0, 1), (-1, inicio_totales - 1), 0.25, colors.lightgrey),
                # Filas de subtotal / flete adicional: bold sutil
                ("FONTNAME", (0, inicio_totales), (-1, -2), "Helvetica-Bold"),
                ("LINEABOVE", (0, inicio_totales), (-1, inicio_totales), 0.4, colors.grey),
                # Total oferta: destacado
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, -1), (-1, -1), 11),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dff1ff")),
                ("LINEABOVE", (0, -1), (-1, -1), 0.6, colors.black),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elems.append(table)
    elems.append(Spacer(1, 12))

    terminos = []
    if cot.get("condiciones_pago"):
        terminos.append(f"<b>Condiciones de pago:</b> {cot['condiciones_pago']}")
    if cot.get("tiempo_entrega"):
        terminos.append(f"<b>Tiempo de entrega:</b> {cot['tiempo_entrega']}")
    terminos.append(f"<b>Vigencia de la oferta:</b> {cot.get('vigencia_dias', 15)} dias calendario")
    if cot.get("notas"):
        terminos.append(f"<b>Notas:</b> {cot['notas']}")
    elems.append(Paragraph("<br/>".join(terminos), st["Terminos"]))

    elems.append(Spacer(1, 16))
    if es_export_usd:
        nota_moneda = (
            f"Precios expresados en dolares americanos (USD) por unidad, aplicando "
            f"TRM de {fmt_miles(trm, 2)} COP/USD a la fecha de la cotizacion. "
            f"Cualquier variacion cambiaria significativa puede ajustarse al "
            f"momento de la facturacion."
        )
    else:
        nota_moneda = (
            "Precios expresados en pesos colombianos (COP) por unidad, sin IVA "
            "salvo indicacion expresa."
        )
    elems.append(
        Paragraph(
            f"Esta oferta es indicativa y esta sujeta a confirmacion al recibir orden de "
            f"compra. {nota_moneda}",
            st["Pequeno"],
        )
    )
    elems.append(Spacer(1, 6))
    elems.append(
        Paragraph(
            f"Generado el {datetime.now().strftime('%Y-%m-%d %H:%M')} - {empresa}",
            st["Pequeno"],
        )
    )

    doc.build(elems)
    return salida
