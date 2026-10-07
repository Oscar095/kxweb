"""Cargas del ERP y respaldos desde la app (pantalla Configuración del gerente).

En Azure no hay consola: el gerente sube los archivos del ERP desde la app.
    - Inventario (.xls/.xlsx): costos y lista de productos (costos_inventario).
    - Ventas (.xlsx): clientes, vendedores y referencia de precios (importar_erp).
    - Catalogo corregido (.xlsx): reemplaza el catalogo (p. ej. con la hoja AjustesCosto).
    - Respaldo: base de datos y catalogo en un .zip.
"""
from __future__ import annotations

import io
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

import pandas as pd

from . import costos_inventario, importar_erp
from .config import CATALOGO_XLSX, DB_PATH

_COLUMNAS_ITEMS = {"DESCRIPCION", "CALIBRE", "COSTO"}


def _con_archivo(nombre: str, contenido: bytes, accion):
    """Guarda lo subido en una carpeta temporal con su nombre original y ejecuta la accion."""
    with tempfile.TemporaryDirectory() as carpeta:
        ruta = Path(carpeta) / Path(nombre).name
        ruta.write_bytes(contenido)
        return accion(ruta)


def cargar_inventario(nombre: str, contenido: bytes, destino: Path = CATALOGO_XLSX,
                      db_path: Path | str = DB_PATH) -> dict:
    return _con_archivo(nombre, contenido, lambda ruta: costos_inventario.cargar(ruta, destino, db_path=db_path))


def cargar_ventas(nombre: str, contenido: bytes, destino: Path = CATALOGO_XLSX,
                  db_path: Path | str = DB_PATH) -> dict:
    return _con_archivo(nombre, contenido, lambda ruta: importar_erp.importar(ruta, db_path=db_path, destino=destino))


def _copia_historico(archivo: Path) -> Path | None:
    if not archivo.exists():
        return None
    historico = archivo.parent / "historico"
    historico.mkdir(exist_ok=True)
    copia = historico / f"{archivo.stem}_{datetime.now():%Y-%m-%d_%H%M%S}{archivo.suffix}"
    shutil.copy2(archivo, copia)
    return copia


def reemplazar_catalogo(contenido: bytes, destino: Path = CATALOGO_XLSX) -> Path | None:
    """Valida el Excel subido y reemplaza el catalogo. Devuelve la copia del anterior."""
    try:
        items = pd.read_excel(io.BytesIO(contenido), sheet_name="Items")
    except ValueError as exc:
        raise ValueError("El archivo no tiene la hoja «Items» del catálogo.") from exc
    faltan = _COLUMNAS_ITEMS - set(items.columns)
    if faltan:
        raise ValueError(f"A la hoja Items le faltan las columnas: {', '.join(sorted(faltan))}.")
    if items.empty or pd.to_numeric(items["COSTO"], errors="coerce").isna().all():
        raise ValueError("La hoja Items no tiene productos con costo.")
    copia = _copia_historico(destino)
    destino.write_bytes(contenido)
    return copia


def respaldo_zip(db_path: Path | str = DB_PATH, catalogo: Path = CATALOGO_XLSX) -> bytes:
    """Base de datos (copia en caliente, segura con la app en uso) y catalogo en un .zip."""
    buffer = io.BytesIO()
    with tempfile.TemporaryDirectory() as carpeta, zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        copia = Path(carpeta) / "cotizador.db"
        origen, destino = sqlite3.connect(str(db_path)), sqlite3.connect(str(copia))
        try:
            origen.backup(destino)
        finally:
            destino.close()
            origen.close()
        zf.write(copia, "cotizador.db")
        if Path(catalogo).exists():
            zf.write(catalogo, "catalogo.xlsx")
    return buffer.getvalue()
