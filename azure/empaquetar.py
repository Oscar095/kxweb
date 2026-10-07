"""Arma el paquete del cotizador para subir a Azure: dist/cotizador_azure_<fecha>.zip

Uso, desde la carpeta del cotizador:
    python azure\\empaquetar.py              (con los datos de hoy, para el primer despliegue)
    python azure\\empaquetar.py --sin-datos  (solo el programa, para actualizar una version)

El paquete trae el programa, la plantilla Word, el Dockerfile y, en data_inicial/,
una copia de la base de datos (usuarios, cotizaciones) y del catalogo de hoy. En el
primer arranque en Azure esos datos pasan al almacenamiento permanente. No incluye
claves temporales, respaldos, informes ni pruebas.
"""
from __future__ import annotations

import sqlite3
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
INCLUIR = ("app.py", "requirements.txt", "Dockerfile", ".dockerignore", "README.md", "GUIA_AZURE.md",
           "src", "azure", "plantillas/cotizacion_kos.docx")


def _archivos(raiz: Path):
    for ruta in INCLUIR:
        origen = raiz / ruta
        candidatos = sorted(origen.rglob("*")) if origen.is_dir() else [origen]
        for archivo in candidatos:
            if archivo.is_file() and "__pycache__" not in archivo.parts and archivo.suffix != ".pyc":
                yield archivo, archivo.relative_to(raiz).as_posix()


def empaquetar(destino: Path = RAIZ / "dist", con_datos: bool = True, raiz: Path = RAIZ) -> Path:
    nombre = f"cotizador_azure_{datetime.now():%Y-%m-%d_%H%M}"
    destino.mkdir(parents=True, exist_ok=True)
    paquete = destino / f"{nombre}.zip"
    with zipfile.ZipFile(paquete, "w", zipfile.ZIP_DEFLATED) as zf:
        for archivo, rel in _archivos(raiz):
            contenido = archivo.read_bytes()
            if archivo.suffix == ".sh" or archivo.name == "Dockerfile":
                contenido = contenido.replace(b"\r\n", b"\n")  # scripts de Linux: saltos LF
            zf.writestr(f"{nombre}/{rel}", contenido)
        if con_datos:
            base, catalogo = raiz / "data" / "cotizador.db", raiz / "data" / "catalogo.xlsx"
            if base.exists():
                with tempfile.TemporaryDirectory() as carpeta:
                    copia_ruta = Path(carpeta) / "cotizador.db"
                    # Copia en caliente: segura aunque la app este abierta
                    origen, copia = sqlite3.connect(base), sqlite3.connect(copia_ruta)
                    try:
                        origen.backup(copia)
                    finally:
                        copia.close()
                        origen.close()
                    zf.write(copia_ruta, f"{nombre}/data_inicial/cotizador.db")
            if catalogo.exists():
                zf.write(catalogo, f"{nombre}/data_inicial/catalogo.xlsx")
    return paquete


if __name__ == "__main__":
    paquete = empaquetar(con_datos="--sin-datos" not in sys.argv)
    print(f"Paquete listo: {paquete} ({paquete.stat().st_size / 1024:.0f} KB)")
