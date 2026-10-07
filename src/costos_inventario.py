"""Costos y lista de productos a cotizar desde el Excel de inventarios del ERP.

Uso, desde la carpeta del cotizador:
    python -m src.costos_inventario "ruta\\inventarios con costos y movimientos v06oct26.xls"

Es la UNICA fuente del costo (antes del flete unitario de 12 COP, que se suma aparte).
El archivo trae una fila por item + diseño (Desc. normal detalle ext. 1) + calibre
(Desc. detalle ext. 2) con su costo promedio y su ultimo costo. El costo se calcula
por Desc. item + Desc. detalle ext. 2; el diseño no cuenta.

1. Costo de cada diseño: si el costo promedio y el ultimo costo son validos (> 0) y no
   difieren mas de 25%, el mayor. Si difieren mas (errores de costeo del ERP, p. ej.
   3.684 frente a 77,89), el que este mas cerca de la referencia logica del producto:
   los otros diseños del mismo producto + calibre o, si no los hay, el mismo producto
   en otro calibre o el producto base ('VASO 4 OZ' para 'VASO 4 OZ LIBRE DE PLASTICO').
   Sin referencia se toma el mayor y queda marcado para revisar.
2. Costo del producto + calibre: se descartan los diseños por fuera de 0,5 a 2 veces la
   mediana del grupo y el resto se promedia ponderando por existencias.
3. Lista de productos: todo el archivo menos insumos (zuncho) y productos sin ningun
   movimiento en los ultimos 2 años.

El catalogo conserva clientes, referencia de precios de venta y unidades de empaque
del catalogo vigente; los ajustes del gerente (hoja AjustesCosto) siguen aplicando.
Cada corrida deja el detalle en data/auditoria_costos_inventario_<fecha>.xlsx.
"""
from __future__ import annotations

import argparse
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from . import database
from .config import CATALOGO_XLSX, DB_PATH

FLETE_UNITARIO = 12.0
SIN_CALIBRE = "NO APLICA"
DESVIACION_MAXIMA = 0.25      # promedio frente a ultimo costo
RANGO_GRUPO = (0.5, 2.0)      # diseño frente a la mediana del producto + calibre
INCOHERENTE = 2.0             # diseños coherentes que difieren mas que esto: grupo contradictorio
TOLERANCIA_DUDOSO = 1.4       # si promedio y ultimo no coinciden, el elegido no puede alejarse mas de la referencia
AÑOS_SIN_MOVIMIENTO = 2
INSUMOS = ("ZUNCHO",)         # no son productos para cotizar
HOJA_AJUSTES = "AjustesCosto"
_COLUMNAS = {
    "codigo": "item",
    "item": "desc. item",
    "diseno": "desc. normal detalle ext. 1",
    "calibre": "desc. detalle ext. 2",
    "promedio": "costo prom",
    "ultimo": "ultimo costo",
    "existencia": "existencia",
    "f_entrada": "fecha ultima entrada",
    "f_venta": "fecha ultima venta",
    "f_compra": "fecha ultima compra",
    "f_salida": "fecha ultima salida",
}
_FECHAS = ("f_entrada", "f_venta", "f_compra", "f_salida")
# Columnas del catalogo vigente que no son costo y se conservan (referencia de precios, empaque)
_PREFIJOS_CONSERVAR = ("PRECIO_", "CLIENTE_", "CANTIDAD_", "FECHA_")
_CONSERVAR = ("Und Empaque", "VENTAS", "CLIENTES")


def _norm(texto) -> str:
    t = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return " ".join(t.upper().split())


def _decimal(valor: float, decimales: int = 2) -> str:
    return f"{valor:,.{decimales}f}".replace(",", "_").replace(".", ",").replace("_", ".")


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------


def leer_inventario(ruta: Path | str) -> pd.DataFrame:
    crudo = pd.read_excel(ruta, dtype=object)
    por_nombre = {_norm(c).lower(): c for c in crudo.columns}
    columnas = {}
    for destino, buscado in _COLUMNAS.items():
        origen = (por_nombre.get(buscado) if destino == "codigo"
                  else next((o for n, o in por_nombre.items() if n.startswith(buscado)), None))
        if origen is None:
            raise ValueError(f"Falta la columna '{buscado}' en {ruta}")
        columnas[origen] = destino
    inv = crudo[list(columnas)].rename(columns=columnas)
    for col in ("codigo", "item", "diseno", "calibre"):
        inv[col] = inv[col].fillna("").astype(str).map(lambda v: " ".join(v.split()))
    inv = inv[inv["item"] != ""].copy()
    inv["calibre"] = inv["calibre"].where(inv["calibre"] != "", SIN_CALIBRE)
    for col in ("promedio", "ultimo", "existencia"):
        inv[col] = pd.to_numeric(inv[col], errors="coerce").fillna(0.0)
    for col in _FECHAS:
        inv[col] = pd.to_datetime(inv[col], errors="coerce")
    return inv.reset_index(drop=True)


def productos_excluidos(inv: pd.DataFrame) -> pd.DataFrame:
    """Insumos y productos sin ningun movimiento en los ultimos 2 años: no se cotizan."""
    ultimo = inv[list(_FECHAS)].max(axis=1)
    corte = ultimo.max() - pd.DateOffset(years=AÑOS_SIN_MOVIMIENTO)
    por_item = ultimo.groupby(inv["item"]).max()
    filas = []
    for item, fecha in por_item.items():
        if _norm(item).startswith(INSUMOS):
            filas.append((item, "Insumo, no es producto para cotizar"))
        elif pd.isna(fecha) or fecha < corte:
            cuando = "nunca" if pd.isna(fecha) else f"{fecha:%Y-%m-%d}"
            filas.append((item, f"Sin movimiento en {AÑOS_SIN_MOVIMIENTO} años (ultimo: {cuando})"))
    return pd.DataFrame(filas, columns=["DESCRIPCION", "MOTIVO"])


# ---------------------------------------------------------------------------
# Costos
# ---------------------------------------------------------------------------


def _texto(item: str) -> list[str]:
    """'TAPA CARTON VASO 7OZ' == 'TAPA CARTON VASO 7 OZ'; 'ANILLO 7 - 9' == 'ANILLO 7- 9'."""
    t = re.sub(r"(\d)OZ\b", r"\1 OZ", _norm(item))
    t = re.sub(r"\s*-\s*", "-", t)
    return [w for w in t.split() if w != "OZ"]


def _palabras(item: str) -> frozenset:
    return frozenset(_texto(item))


def _tipo(item: str) -> tuple:
    """Solo se comparan productos del mismo tipo (mismas dos primeras palabras: 'VASO 4',
    'TAPA PLANA', 'VASO DP') y del mismo origen: un importado (IMP) no se compara con
    uno fabricado."""
    palabras = _texto(item)
    return tuple(palabras[:2]), "IMP" in palabras


def _mediana(valores) -> float | None:
    v = [x for x in valores if x and x > 0]
    return float(np.median(v)) if v else None


def _cercano(candidatos: list[float], ref: float) -> float:
    return min(candidatos, key=lambda c: abs(np.log(c / ref)))


def _referencia(valores) -> float | None:
    """Costo de referencia confiable de una lista de costos, o None si se contradicen.

    Confiable si al menos el 80% de los costos esta entre 0,5 y 2 veces la mediana (con uno
    o dos costos, si no difieren mas del doble). Un grupo partido (p. ej. 2 diseños a 150 y
    2 a 600) no da referencia: hay que buscarla en otro producto o revisarlo.
    """
    v = [x for x in valores if x and x > 0]
    if not v:
        return None
    med = float(np.median(v))
    dentro = [x for x in v if RANGO_GRUPO[0] * med <= x <= RANGO_GRUPO[1] * med]
    if len(v) <= 2:
        return med if max(v) / min(v) <= INCOHERENTE else None
    return float(np.median(dentro)) if len(dentro) / len(v) >= 0.8 else None


def calcular_costos(inv: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Devuelve (productos, diseños): costo por Desc. item + calibre y el detalle de cada fila."""
    d = inv.copy()
    p_ok, u_ok = d["promedio"] > 0, d["ultimo"] > 0
    ambos = p_ok & u_ok
    desviacion = (d["promedio"] / d["ultimo"].where(u_ok) - 1).abs()
    d["coherente"] = ambos & (desviacion <= DESVIACION_MAXIMA)
    d["costo_fijo"] = np.where(d["coherente"], d[["promedio", "ultimo"]].max(axis=1), np.nan)

    # Referencias: costos de diseños coherentes por producto + calibre y por producto
    fijos = d[d["coherente"]]
    por_grupo = fijos.groupby(["item", "calibre"])["costo_fijo"].apply(list).to_dict()
    por_item = fijos.groupby("item")["costo_fijo"].apply(list).to_dict()
    palabras = {i: _palabras(i) for i in d["item"].unique()}
    tipos = {i: _tipo(i) for i in palabras}

    def referencia_externa(item: str, calibre: str) -> tuple[float | None, str]:
        """Mismo producto en otro calibre; si no, el producto base o sus otras versiones."""
        otros = [c for (i, cal), vals in por_grupo.items() if i == item and cal != calibre for c in vals]
        if (ref := _referencia(otros)) is not None:
            return ref, "el mismo producto en otro calibre"
        propias = palabras[item]
        for relacion, cond in (("el producto base", lambda k: k < propias),
                               ("otras versiones del producto", lambda k: k > propias)):
            parientes = [i for i, k in palabras.items()
                         if i != item and k and cond(k) and tipos[i] == tipos[item]]
            for mismo_calibre in (True, False):
                vals = [c for p in parientes for (i, cal), vs in por_grupo.items()
                        if i == p and (cal == calibre or not mismo_calibre) for c in vs]
                if (ref := _referencia(vals)) is not None:
                    return ref, f"{relacion} ({', '.join(sorted(parientes)[:2])})"
        return None, ""

    filas_prod, filas_det = [], []
    for (item, calibre), g in d.groupby(["item", "calibre"], sort=True):
        notas, revisar = [], []
        propios = por_grupo.get((item, calibre), [])
        externa, fuente = referencia_externa(item, calibre)
        if (ref_propia := _referencia(propios)) is not None:
            ref, base_ref = ref_propia, "otros diseños del producto"
        elif propios and externa:
            dentro = [c for c in propios if RANGO_GRUPO[0] * externa <= c <= RANGO_GRUPO[1] * externa]
            ref, base_ref = (_mediana(dentro) or externa), fuente
            notas.append(f"Diseños con costos contradictorios: se usó como referencia {fuente}")
        elif propios:
            ref, base_ref = _mediana(propios), "otros diseños del producto"
            revisar.append("Diseños con costos contradictorios y sin otro producto para comparar")
        else:
            ref, base_ref = externa, fuente

        costos, dudosos = [], set()
        for r in g.itertuples():
            validos = [v for v in (r.promedio, r.ultimo) if v > 0]
            if r.coherente:
                costo, decision = r.costo_fijo, "Promedio y último coinciden: el mayor"
            elif not validos:
                costo, decision = np.nan, "Sin costo válido"
            elif len(validos) == 1:
                costo = validos[0]
                decision = "Solo " + ("costo promedio" if r.promedio > 0 else "último costo") + " válido"
                if min(r.promedio, r.ultimo) < 0 and ref is None:
                    otro = "promedio" if r.promedio < 0 else "último costo"
                    revisar.append(f"El ERP trae {otro} negativo y no hay con qué comparar el otro")
            elif ref:
                costo = _cercano(validos, ref)
                cual = "promedio" if costo == r.promedio else "último costo"
                decision = (f"Promedio {_decimal(r.promedio)} y último {_decimal(r.ultimo)} no coinciden: "
                            f"se tomó el {cual}, coherente con {base_ref}")
                if abs(np.log(costo / ref)) > np.log(TOLERANCIA_DUDOSO):
                    dudosos.add(r.Index)
                    decision = (f"Promedio {_decimal(r.promedio)} y último {_decimal(r.ultimo)} no coinciden y "
                                f"ninguno es coherente con {base_ref} ({_decimal(ref)})")
            else:
                costo = max(validos)
                decision = "Promedio y último no coinciden y no hay con qué comparar: se tomó el mayor"
                revisar.append(f"Promedio {_decimal(r.promedio)} y último {_decimal(r.ultimo)} no coinciden")
            costos.append(costo)
            filas_det.append({
                "DESCRIPCION": item, "CALIBRE": calibre, "CODIGO": r.codigo, "DISENO": r.diseno,
                "COSTO_PROMEDIO": r.promedio, "ULTIMO_COSTO": r.ultimo, "EXISTENCIA": r.existencia,
                "COSTO_DISENO": round(float(costo), 2) if costo == costo else None, "DECISION": decision,
            })

        g = g.assign(costo=costos)
        centro = ref or _mediana(g["costo"])
        bajo, alto = RANGO_GRUPO
        usado = (g["costo"] >= bajo * centro) & (g["costo"] <= alto * centro) if centro else g["costo"] > 0
        usado &= ~g.index.isin(dudosos)
        for det, u, c, idx in zip(filas_det[-len(g):], usado, g["costo"], g.index):
            det["USADO"] = "Sí" if u else "No"
            if idx in dudosos:
                det["DECISION"] += ": excluido"
            elif not u and c == c:
                det["DECISION"] += (f". Excluido: {_decimal(c / centro, 1)} veces la referencia del producto"
                                    if centro else ". Excluido")
        usados = g[usado]
        excl = g.loc[~usado, "existencia"].sum() / g["existencia"].sum() if g["existencia"].sum() else 0
        if usados.empty:
            # Ningun diseño es coherente: el producto no sale de la lista, se estima y se marca.
            if ref:
                costo, base = ref, f"Estimado con {base_ref}: ningún diseño tenía un costo coherente"
            elif (g["costo"] > 0).any():
                costo, base = _mediana(g["costo"]), "Mediana de diseños sin referencia"
            else:
                continue
            revisar.append("Costo estimado: ningún diseño del inventario era coherente")
        else:
            peso = usados["existencia"].clip(lower=0)
            costo = (float((usados["costo"] * peso).sum() / peso.sum()) if peso.sum() > 0
                     else float(usados["costo"].mean()))
            base = (f"Inventario: {len(usados)} de {len(g)} diseño{'s' if len(g) != 1 else ''}"
                    + (", ponderado por existencias" if len(usados) > 1 else ""))
        filas_prod.append({
            "DESCRIPCION": item, "CALIBRE": calibre, "COSTO": round(costo, 2),
            "BASE_COSTO": ". ".join([base, *notas]), "REVISAR_COSTO": "; ".join(dict.fromkeys(revisar)),
            "DISENOS": len(g), "DISENOS_USADOS": len(usados), "EXISTENCIA": float(g["existencia"].sum()),
            "EXISTENCIA_EXCLUIDA_%": round(excl * 100, 1),
        })
    productos = pd.DataFrame(filas_prod)
    productos["REVISAR_COSTO"] = _revisar_calibres(productos)
    return productos, pd.DataFrame(filas_det)


def _num_calibre(calibre: str) -> float | None:
    m = re.fullmatch(r"C/0[.,](\d{3})", str(calibre or "").strip().upper())
    return float(m.group(1)) if m else None


def _revisar_calibres(productos: pd.DataFrame) -> pd.Series:
    """Agrega a REVISAR_COSTO los calibres que no cuadran: el mas delgado cuesta >15% mas,
    o el mas grueso mas del doble."""
    notas = productos["REVISAR_COSTO"].copy()
    con_num = productos.assign(_n=productos["CALIBRE"].map(_num_calibre)).dropna(subset=["_n"])
    for _, g in con_num.groupby("DESCRIPCION"):
        g = g.sort_values("_n")
        for (i1, a), (i2, b) in zip(g.iterrows(), list(g.iterrows())[1:]):
            if a["COSTO"] > b["COSTO"] * 1.15 or b["COSTO"] > a["COSTO"] * 1.8:
                dudoso, otro = (i1, b) if a["EXISTENCIA"] <= b["EXISTENCIA"] else (i2, a)
                texto = f"No cuadra con el calibre {otro['CALIBRE']} ({_decimal(otro['COSTO'])})"
                notas[dudoso] = "; ".join(x for x in (notas[dudoso], texto) if x)
    return notas


# ---------------------------------------------------------------------------
# Ajustes del gerente
# ---------------------------------------------------------------------------


def leer_ajustes(ruta: Path | str) -> pd.DataFrame:
    """Hoja AjustesCosto del catalogo: costos fijados a mano (DESCRIPCION, CALIBRE, COSTO, MOTIVO)."""
    columnas = ["DESCRIPCION", "CALIBRE", "COSTO", "MOTIVO"]
    try:
        aj = pd.read_excel(ruta, sheet_name=HOJA_AJUSTES)
    except (ValueError, FileNotFoundError):
        return pd.DataFrame(columns=columnas)
    aj.columns = [str(c).strip().upper() for c in aj.columns]
    for col in columnas:
        if col not in aj.columns:
            aj[col] = None
    return aj[columnas].dropna(subset=["DESCRIPCION"])


def aplicar_ajustes(productos: pd.DataFrame, ajustes: pd.DataFrame) -> pd.DataFrame:
    """El costo del gerente reemplaza al calculado; COSTO_INVENTARIO conserva el calculado."""
    productos = productos.copy()
    productos["COSTO_INVENTARIO"] = productos["COSTO"]
    for r in ajustes.itertuples(index=False):
        costo = pd.to_numeric(r.COSTO, errors="coerce")
        if pd.isna(costo) or costo <= 0:
            continue
        calibre = r.CALIBRE if isinstance(r.CALIBRE, str) and r.CALIBRE.strip() else SIN_CALIBRE
        m = ((productos["DESCRIPCION"].map(_norm) == _norm(r.DESCRIPCION))
             & (productos["CALIBRE"].map(_norm) == _norm(calibre)))
        motivo = str(r.MOTIVO).strip() if isinstance(r.MOTIVO, str) and r.MOTIVO.strip() else "sin motivo"
        productos.loc[m, "COSTO"] = float(costo)
        productos.loc[m, "BASE_COSTO"] = f"Ajuste manual: {motivo}"
        productos.loc[m, "REVISAR_COSTO"] = ""
    return productos


# ---------------------------------------------------------------------------
# Catalogo e informe
# ---------------------------------------------------------------------------


def _ajustar_anchos(xw: pd.ExcelWriter) -> None:
    for hoja in xw.book.worksheets:
        for columna in hoja.columns:
            largo = max(len(str(c.value or "")) for c in columna)
            hoja.column_dimensions[columna[0].column_letter].width = min(max(12, largo + 2), 70)


def _hoja(ruta: Path, nombre: str) -> pd.DataFrame | None:
    try:
        return pd.read_excel(ruta, sheet_name=nombre)
    except (ValueError, FileNotFoundError):
        return None


def armar_items(productos: pd.DataFrame, anterior: pd.DataFrame | None) -> pd.DataFrame:
    """Items del catalogo: costo del inventario + datos del catalogo anterior que no son costo."""
    items = productos[["DESCRIPCION", "CALIBRE", "COSTO", "COSTO_INVENTARIO", "BASE_COSTO", "REVISAR_COSTO",
                       "DISENOS", "DISENOS_USADOS", "EXISTENCIA", "EXISTENCIA_EXCLUIDA_%"]]
    if anterior is not None and not anterior.empty:
        conservar = [c for c in anterior.columns
                     if c in _CONSERVAR or str(c).startswith(_PREFIJOS_CONSERVAR)]
        if conservar:
            previo = anterior[["DESCRIPCION", "CALIBRE", *conservar]].drop_duplicates(["DESCRIPCION", "CALIBRE"])
            items = items.merge(previo, on=["DESCRIPCION", "CALIBRE"], how="left")
    if "Und Empaque" in items.columns:
        items.insert(2, "Und Empaque", items.pop("Und Empaque"))
    return items.sort_values(["DESCRIPCION", "CALIBRE"]).reset_index(drop=True)


def escribir_catalogo(items: pd.DataFrame, origen: Path, excluidos: pd.DataFrame,
                      destino: Path = CATALOGO_XLSX, ajustes: pd.DataFrame | None = None,
                      db_path: Path | str = DB_PATH) -> Path:
    """Reemplaza el catalogo: Items nuevos; clientes y referencia de precios se conservan."""
    politica = database.obtener_politica(db_path)
    precios, clientes = _hoja(destino, "PreciosClientes"), _hoja(destino, "Clientes")
    leame = pd.DataFrame({"Tema": [
        "Origen del costo", "Nivel del costo", "Costo de cada diseño", "Costo del producto", "Revisar",
        "Lista de productos", "Flete", "Ajustes del gerente", "Clientes y referencia de precios", "Actualizado",
    ], "Detalle": [
        f"{origen.name} (inventario con costo promedio y último costo). Es la única fuente del costo.",
        "Desc. item + Desc. detalle ext. 2 (calibre). El diseño (Desc. normal detalle ext. 1) no cuenta.",
        f"El mayor entre costo promedio y último costo si no difieren más de {DESVIACION_MAXIMA:.0%}; si difieren, "
        "el más coherente con los otros diseños, el mismo producto en otro calibre o el producto base.",
        "Promedio ponderado por existencias de los diseños entre 0,5 y 2 veces la mediana del producto.",
        "REVISAR_COSTO marca los costos dudosos. Detalle en data/auditoria_costos_inventario_<fecha>.xlsx.",
        f"Todo el inventario menos insumos y productos sin movimiento en {AÑOS_SIN_MOVIMIENTO} años "
        f"({len(excluidos)} excluidos).",
        f"{FLETE_UNITARIO:.0f} COP por unidad, se suma al costo (hoja FLETE).",
        f"Hoja {HOJA_AJUSTES}: DESCRIPCION, CALIBRE, COSTO, MOTIVO. Reemplaza el costo calculado "
        "(COSTO_INVENTARIO muestra el calculado) y se conserva en las siguientes cargas.",
        "Se conservan del catálogo anterior (hojas Clientes y PreciosClientes, columnas PRECIO_*).",
        datetime.now().strftime("%Y-%m-%d %H:%M"),
    ]})
    if ajustes is None or ajustes.empty:
        ajustes = pd.DataFrame(columns=["DESCRIPCION", "CALIBRE", "COSTO", "MOTIVO"])
    destino.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(destino, engine="openpyxl") as xw:
        items.to_excel(xw, sheet_name="Items", index=False)
        if precios is not None:
            precios.to_excel(xw, sheet_name="PreciosClientes", index=False)
        pd.DataFrame({"RUBRO": ["FLETE"], "PRECIO": [FLETE_UNITARIO]}).to_excel(xw, sheet_name="FLETE", index=False)
        if clientes is not None:
            clientes.to_excel(xw, sheet_name="Clientes", index=False)
        pd.DataFrame({"umbral_comercial": [politica.umbral_comercial],
                      "umbral_financiero": [politica.umbral_financiero]}).to_excel(
            xw, sheet_name="Politica", index=False)
        ajustes.to_excel(xw, sheet_name=HOJA_AJUSTES, index=False)
        leame.to_excel(xw, sheet_name="Leame", index=False)
        _ajustar_anchos(xw)
    return destino


def escribir_informe(items: pd.DataFrame, disenos: pd.DataFrame, excluidos: pd.DataFrame,
                     anterior: pd.DataFrame | None, destino: Path) -> Path:
    """Informe para el gerente (tiene costos: no se comparte con vendedores)."""
    prod = items[["DESCRIPCION", "CALIBRE", "COSTO", "BASE_COSTO", "REVISAR_COSTO", "DISENOS", "DISENOS_USADOS",
                  "EXISTENCIA", "EXISTENCIA_EXCLUIDA_%"]].copy()
    if anterior is not None and {"DESCRIPCION", "CALIBRE", "COSTO"} <= set(anterior.columns):
        previo = anterior[["DESCRIPCION", "CALIBRE", "COSTO"]].rename(columns={"COSTO": "COSTO_ANTERIOR"})
        prod = prod.merge(previo.drop_duplicates(["DESCRIPCION", "CALIBRE"]), on=["DESCRIPCION", "CALIBRE"], how="left")
        prod.insert(3, "COSTO_ANTERIOR", prod.pop("COSTO_ANTERIOR"))
        prod.insert(4, "CAMBIO_%", ((prod["COSTO"] / prod["COSTO_ANTERIOR"] - 1) * 100).round(1))
    usados = disenos["USADO"] == "Sí"
    resumen = pd.DataFrame({"Dato": [
        "Filas del inventario (item + diseño + calibre)", "Productos a cotizar (Desc. item + calibre)",
        "Diseños usados en el costo", "Diseños excluidos por costo atípico o sin costo",
        "Diseños con promedio y último que no coinciden", "Productos para revisar (REVISAR_COSTO)",
        "Productos excluidos de la lista (insumos o sin movimiento)",
    ], "Valor": [
        len(disenos), len(items), int(usados.sum()), int((~usados).sum()),
        int(disenos["DECISION"].str.contains("no coinciden").sum()), int((items["REVISAR_COSTO"] != "").sum()),
        len(excluidos),
    ]})
    destino.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(destino, engine="openpyxl") as xw:
        resumen.to_excel(xw, sheet_name="Resumen", index=False)
        prod.to_excel(xw, sheet_name="Productos", index=False)
        disenos.to_excel(xw, sheet_name="Disenos", index=False)
        excluidos.to_excel(xw, sheet_name="ExcluidosDeLaLista", index=False)
        _ajustar_anchos(xw)
    return destino


def cargar(ruta: Path | str, destino: Path = CATALOGO_XLSX, db_path: Path | str = DB_PATH) -> dict:
    """Calcula los costos del inventario y reemplaza el catalogo."""
    ruta, destino = Path(ruta), Path(destino)
    inv = leer_inventario(ruta)
    excluidos = productos_excluidos(inv)
    inv = inv[~inv["item"].isin(set(excluidos["DESCRIPCION"]))]
    productos, disenos = calcular_costos(inv)
    ajustes = leer_ajustes(destino)
    productos = aplicar_ajustes(productos, ajustes)
    anterior = _hoja(destino, "Items")
    items = armar_items(productos, anterior)
    database.inicializar(db_path)
    escribir_catalogo(items, ruta, excluidos, destino, ajustes, db_path)
    informe = escribir_informe(items, disenos, excluidos, anterior,
                               destino.parent / f"auditoria_costos_inventario_{datetime.now():%Y-%m-%d}.xlsx")
    return {"items": items, "disenos": disenos, "excluidos": excluidos, "informe": informe}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Costos y productos a cotizar desde el inventario del ERP.")
    parser.add_argument("archivo", help="Excel de inventarios con costo promedio y último costo")
    args = parser.parse_args(argv)
    r = cargar(args.archivo)
    items, disenos = r["items"], r["disenos"]
    print(f"Productos a cotizar: {len(items)} | diseños usados {(disenos['USADO'] == 'Sí').sum()} de {len(disenos)}")
    print(f"Para revisar: {(items['REVISAR_COSTO'] != '').sum()} | excluidos de la lista: {len(r['excluidos'])}")
    print(f"Informe: {r['informe']}")


if __name__ == "__main__":
    main()
