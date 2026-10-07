"""Oferta en PDF con la plantilla Word de Kos, SIN Microsoft Word (servidores Linux, Azure).

La plantilla (plantillas/cotizacion_kos.docx) se llena editando directamente su XML:
cada marcador {{...}} esta completo dentro de un parrafo, asi que se reemplaza por su
valor o, si no tiene valor, se quita el parrafo; {{TABLA}} se cambia por la tabla de
precios con el mismo formato que arma Word (ver plantilla_word._insertar_tabla). Luego
LibreOffice (sin interfaz) la convierte a PDF.

Los datos de la carta son los mismos de plantilla_word.datos_oferta.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import threading
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from .plantilla_word import ANCHOS_TABLA, AZUL_TABLA, PLANTILLA_DOCX

_LOCK = threading.Lock()  # LibreOffice no admite dos conversiones a la vez con el mismo perfil
_DOCUMENTO = "word/document.xml"
_ANCHOS = [round(a * 20) for a in ANCHOS_TABLA]  # puntos -> veinteavos de punto (dxa)


def _soffice() -> str | None:
    return os.environ.get("COTIZADOR_SOFFICE") or shutil.which("soffice") or shutil.which("libreoffice")


def disponible() -> bool:
    return PLANTILLA_DOCX.exists() and _soffice() is not None


# ---------------------------------------------------------------------------
# Llenado del documento
# ---------------------------------------------------------------------------


def _parrafo_de(xml: str, i: int) -> tuple[int, int]:
    """Inicio y fin del parrafo (<w:p ...>...</w:p>) que contiene la posicion i."""
    inicio = max(xml.rfind("<w:p ", 0, i), xml.rfind("<w:p>", 0, i))
    fin = xml.find("</w:p>", i) + len("</w:p>")
    if inicio < 0 or fin < len("</w:p>"):
        raise ValueError("La plantilla no tiene la estructura esperada")
    return inicio, fin


def _celda(texto: str, ancho: int, *, tam: int = 15, fondo: str | None = None,
           color: str | None = None, columnas: int = 1) -> str:
    tc = f'<w:tcW w:w="{ancho}" w:type="dxa"/>'
    if columnas > 1:
        tc += f'<w:gridSpan w:val="{columnas}"/>'
    if fondo:
        tc += f'<w:shd w:val="clear" w:color="auto" w:fill="{fondo}"/>'
    tc += '<w:vAlign w:val="center"/>'
    r = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>'
    if color:
        r += f'<w:color w:val="{color}"/>'
    r += f'<w:sz w:val="{tam}"/><w:szCs w:val="{tam}"/>'
    return (f'<w:tc><w:tcPr>{tc}</w:tcPr><w:p><w:pPr>'
            '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>'
            f'</w:pPr><w:r><w:rPr>{r}</w:rPr><w:t xml:space="preserve">{escape(str(texto))}</w:t></w:r></w:p></w:tc>')


def tabla_xml(tabla: dict) -> str:
    """Tabla de precios: titulo azul, encabezados azules con letra blanca y una fila por producto.
    Titulo y encabezados se repiten si la tabla pasa a otra pagina."""
    azul = AZUL_TABLA.lstrip("#").upper()
    borde = '<w:{} w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
    bordes = "".join(borde.format(lado) for lado in ("top", "left", "bottom", "right", "insideH", "insideV"))
    total = sum(_ANCHOS)
    partes = [
        f'<w:tbl><w:tblPr><w:tblW w:w="{total}" w:type="dxa"/><w:jc w:val="center"/>'
        f'<w:tblBorders>{bordes}</w:tblBorders><w:tblLayout w:type="fixed"/>'
        '<w:tblCellMar><w:left w:w="72" w:type="dxa"/><w:right w:w="72" w:type="dxa"/></w:tblCellMar>'
        '</w:tblPr><w:tblGrid>' + "".join(f'<w:gridCol w:w="{a}"/>' for a in _ANCHOS) + '</w:tblGrid>',
        '<w:tr><w:trPr><w:tblHeader/></w:trPr>'
        + _celda(tabla["titulo"], total, tam=22, fondo=azul, columnas=len(_ANCHOS)) + '</w:tr>',
        '<w:tr><w:trPr><w:tblHeader/></w:trPr>'
        + "".join(_celda(t, a, fondo=azul, color="FFFFFF") for t, a in zip(tabla["encabezados"], _ANCHOS))
        + '</w:tr>',
    ]
    for fila in tabla["filas"]:
        partes.append("<w:tr>" + "".join(_celda(t, a) for t, a in zip(fila, _ANCHOS)) + "</w:tr>")
    partes.append("</w:tbl>")
    return "".join(partes)


def llenar_documento(xml: str, datos: dict) -> str:
    """document.xml con los marcadores reemplazados y la tabla de precios."""
    for marcador, valor in datos["marcadores"].items():
        while (i := xml.find(marcador)) >= 0:
            if valor:
                xml = xml[:i] + escape(str(valor)) + xml[i + len(marcador):]
            else:
                inicio, fin = _parrafo_de(xml, i)
                xml = xml[:inicio] + xml[fin:]
    i = xml.find("{{TABLA}}")
    if i >= 0:
        inicio, fin = _parrafo_de(xml, i)
        xml = xml[:inicio] + tabla_xml(datos["tabla"]) + xml[fin:]
    return xml


def llenar_docx(datos: dict, salida: Path | str, plantilla: Path | str = PLANTILLA_DOCX) -> Path:
    """Copia la plantilla con los datos de la oferta (sin usar Word)."""
    salida = Path(salida)
    with zipfile.ZipFile(plantilla) as origen, zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as destino:
        for item in origen.infolist():
            contenido = origen.read(item.filename)
            if item.filename == _DOCUMENTO:
                contenido = llenar_documento(contenido.decode("utf-8"), datos).encode("utf-8")
            destino.writestr(item, contenido)
    return salida


# ---------------------------------------------------------------------------
# Conversion a PDF
# ---------------------------------------------------------------------------


def generar_pdf(datos: dict, salida: Path | str, plantilla: Path | str = PLANTILLA_DOCX) -> Path:
    """Llena la plantilla y la convierte a PDF con LibreOffice."""
    soffice = _soffice()
    if soffice is None:
        raise RuntimeError("LibreOffice no está instalado en este equipo.")
    salida = Path(salida).resolve()
    salida.parent.mkdir(parents=True, exist_ok=True)
    perfil = Path(tempfile.gettempdir()) / "cotizador_libreoffice"
    with _LOCK, tempfile.TemporaryDirectory() as carpeta:
        docx = llenar_docx(datos, Path(carpeta) / "oferta.docx", plantilla)
        subprocess.run(
            [soffice, f"-env:UserInstallation={perfil.as_uri()}", "--headless", "--norestore", "--nologo",
             "--convert-to", "pdf", "--outdir", carpeta, str(docx)],
            check=True, capture_output=True, timeout=180,
        )
        pdf = Path(carpeta) / "oferta.pdf"
        if not pdf.exists():
            raise RuntimeError("LibreOffice no generó el PDF.")
        shutil.move(str(pdf), salida)
    return salida
