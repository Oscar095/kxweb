"""Genera la plantilla `data/catalogo.xlsx` con hojas y datos seed.

Hojas:
    - Items
    - Materiales
    - Costos
    - FLETE
    - Clientes
    - Politica
    - LeameCliente (vacio - solo texto orientativo)
"""
from __future__ import annotations

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from .config import CATALOGO_XLSX, POLITICA_DEFAULT

HEADER_FILL = PatternFill("solid", fgColor="0A3D62")
HEADER_FONT = Font(color="FFFFFF", bold=True)


def _set_header(ws, headers):
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=j, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = Alignment(horizontal="center")
    for j in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(j)].width = max(14, len(str(headers[j - 1])) + 2)


def _items_seed():
    return [
        # DESCRIPCION, CALIBRE, GRAMAJE, CINTA, Und Empaque, GRUPO, Material, COSTO (opcional)
        ("VASO 4 OZ", "K010", 2.7, 0.9, 2500, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 7 OZ", "K012", 4.4, 1.0, 2000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 9 OZ", "K012", 5.2, 1.0, 2000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 12 OZ", "K012", 6.4, 1.3, 1000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 12 OZ", "K016", 8.0, 1.3, 1000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 16 OZ", "K012", 9.0, 1.0, 1000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 16 OZ", "K016", 12.0, 1.0, 1000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 21 OZ", "K013", 11.0, 1.3, 1000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("VASO 21 OZ", "K016", 13.5, 1.3, 1000, "FORMADORAS RAPIDAS 1", "POLYBOARD", None),
        ("CONT 12 OZ", "K013", 5.8, 1.3, 1000, "FORMACION CPDS", "POLYBOARD", None),
        ("CONT 12 OZ", "K016", 7.5, 1.3, 1000, "FORMACION CPDS", "POLYBOARD", None),
        ("CONT 16 OZ", "K013", 7.0, 1.3, 1000, "FORMACION CPDS", "POLYBOARD", None),
        ("CONT 32 OZ", "K016", 14.0, 1.3, 500, "FORMACION CPDS", "POLYBOARD", None),
        ("TAPA VASO 7-9 OZ", "K016", 2.0, 0.0, 2000, "TAPAS", "POLYBOARD", None),
        ("TAPA VASO 12-16 OZ", "K016", 2.5, 0.0, 2000, "TAPAS", "POLYBOARD", None),
    ]


def _materiales_seed():
    return [
        ("POLYBOARD", 6840.0, 0.14, 6000.0),
        ("KRAFT", 5472.0, 0.14, 4800.0),
        ("PET", 9408.0, 0.12, 8400.0),
        ("POLIESTIRENO", 6720.0, 0.12, 6000.0),
        ("BIONATURA", 10830.0, 0.14, 9500.0),
    ]


def _costos_seed():
    return [
        ("FORMADORAS RAPIDAS 1", 15.24, 13.47),
        ("FORMADORAS RAPIDAS 2", 15.24, 13.47),
        ("FORMACION CPDS", 17.23, 15.32),
        ("TAPAS", 11.0, 10.0),
    ]


def _flete_seed():
    return [("FLETE", 10.0)]  # COP por unidad (caja). Editable.


def _clientes_seed():
    return [
        ("KFC Colombia", "compras@kfc.co", "Bogota", "Horeca"),
        ("Corral", "compras@corral.co", "Medellin", "Horeca"),
        ("Tostao", "compras@tostao.co", "Bogota", "Horeca"),
    ]


def generar(path=CATALOGO_XLSX) -> None:
    wb = openpyxl.Workbook()

    ws = wb.active
    ws.title = "Items"
    _set_header(ws, ["DESCRIPCION", "CALIBRE", "GRAMAJE", "CINTA", "Und Empaque", "GRUPO", "Material", "COSTO"])
    for row in _items_seed():
        ws.append(list(row))

    ws = wb.create_sheet("Materiales")
    _set_header(ws, ["Material", "Costo", "Desperdicio", "Costo Real"])
    for row in _materiales_seed():
        ws.append(list(row))

    ws = wb.create_sheet("Costos")
    _set_header(ws, ["Grupo", "MOD", "CIF"])
    for row in _costos_seed():
        ws.append(list(row))

    ws = wb.create_sheet("FLETE")
    _set_header(ws, ["RUBRO", "PRECIO"])
    for row in _flete_seed():
        ws.append(list(row))

    ws = wb.create_sheet("Clientes")
    _set_header(ws, ["nombre", "contacto", "ciudad", "segmento"])
    for row in _clientes_seed():
        ws.append(list(row))

    ws = wb.create_sheet("Politica")
    _set_header(ws, ["umbral_comercial", "umbral_financiero"])
    ws.append([POLITICA_DEFAULT.umbral_comercial, POLITICA_DEFAULT.umbral_financiero])

    ws = wb.create_sheet("LeameCliente")
    ws["A1"] = "Hojas INTERNAS (no compartir con vendedor sin filtrar)"
    ws["A1"].font = Font(bold=True)
    ws["A3"] = "Items"
    ws["B3"] = "Catalogo de productos. Columnas mandatorias: DESCRIPCION, CALIBRE."
    ws["A4"] = "Materiales"
    ws["B4"] = "Costo por kg de material. Solo gerente."
    ws["A5"] = "Costos"
    ws["B5"] = "MOD + CIF por grupo de maquina. Solo gerente."
    ws["A6"] = "FLETE"
    ws["B6"] = "Tabla de flete unitario."
    ws["A7"] = "Clientes"
    ws["B7"] = "Maestro de clientes pre-cargado."
    ws["A8"] = "Politica"
    ws["B8"] = "Umbrales UB% (gerente). Tambien editable desde la app."
    for r in range(3, 9):
        ws.column_dimensions["A"].width = 18
        ws.column_dimensions["B"].width = 90

    path = str(path)
    wb.save(path)


def cargar_clientes_iniciales(db_path=None) -> int:
    """Inserta clientes del Excel en BD si aun no existen."""
    from . import database
    from .excel_loader import cargar_catalogo

    cat = cargar_catalogo()
    if cat.clientes.empty:
        return 0
    existentes = {c["nombre"].strip().lower() for c in database.listar_clientes(db_path or database.DB_PATH)}
    n = 0
    for _, r in cat.clientes.iterrows():
        nombre = str(r.get("nombre", "")).strip()
        if not nombre or nombre.lower() in existentes:
            continue
        database.crear_cliente(
            nombre,
            contacto=str(r.get("contacto", "") or ""),
            ciudad=str(r.get("ciudad", "") or ""),
            segmento=str(r.get("segmento", "") or ""),
            es_nuevo=False,
            creado_por="seed",
            db_path=db_path or database.DB_PATH,
        )
        n += 1
    return n


if __name__ == "__main__":
    generar()
    print(f"Plantilla creada en {CATALOGO_XLSX}")
    from . import database

    database.inicializar()
    n = cargar_clientes_iniciales()
    print(f"Clientes seed importados: {n}")

    from . import usuarios
    from .config import CLAVES_INICIALES_TXT

    creados = usuarios.asegurar_usuarios_iniciales()
    if creados:
        print(f"Usuarios creados: {', '.join(creados)}. Claves temporales en {CLAVES_INICIALES_TXT}")
