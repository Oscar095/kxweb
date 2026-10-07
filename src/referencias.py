"""Referencia de precios para el vendedor: lo que realmente pagaron los clientes.

Sale de las ventas del ERP (hoja PreciosClientes y columnas PRECIO_* del catalogo).
Nunca incluye costos ni margenes, asi que el vendedor puede verla.

Los precios mas altos suelen ser pedidos pequenos; por eso la comparacion de cada
linea se hace contra clientes de volumen mensual parecido (la mitad al doble de lo
que se cotiza). Si no hay clientes de ese tamano, se usa el promedio general reciente.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

RANGO_VOLUMEN = (0.5, 2.0)


def _filas(precios: pd.DataFrame, producto: str, calibre: str) -> pd.DataFrame:
    if precios is None or precios.empty:
        return pd.DataFrame()
    return precios[(precios["DESCRIPCION"].astype(str) == str(producto))
                   & (precios["CALIBRE"].astype(str) == str(calibre))]


def _item(items: pd.DataFrame, producto: str, calibre: str) -> pd.Series | None:
    if items is None or items.empty or "PRECIO_MEDIANA" not in items.columns:
        return None
    m = items[(items["DESCRIPCION"].astype(str) == str(producto)) & (items["CALIBRE"].astype(str) == str(calibre))]
    return None if m.empty else m.iloc[0]


def _num(valor) -> float | None:
    return None if valor is None or pd.isna(valor) else float(valor)


def _venta(item: pd.Series, sufijo: str) -> dict | None:
    """Venta con el precio mas alto ('MAX') o mas bajo ('MIN'): precio, cliente, unidades y fecha."""
    precio = _num(item.get(f"PRECIO_{sufijo}"))
    if precio is None:
        return None
    cliente = item.get(f"CLIENTE_{sufijo}")
    return {
        "precio": precio,
        "cliente": str(cliente) if isinstance(cliente, str) else "",
        "cantidad": _num(item.get(f"CANTIDAD_{sufijo}")),
        "fecha": str(item.get(f"FECHA_{sufijo}") or ""),
    }


def referencia(catalogo, producto: str, calibre: str) -> dict | None:
    """Precio mas alto y mas bajo (con su cliente), promedio del periodo y de los ultimos
    3 meses, rango habitual y precios por tamano de cliente."""
    filas = _filas(getattr(catalogo, "precios", None), producto, calibre)
    item = _item(catalogo.items, producto, calibre)
    if item is None:
        return None
    promedio, reciente = _num(item.get("PRECIO_PROMEDIO")), _num(item.get("PRECIO_PROM_3M"))
    clientes = _num(item.get("CLIENTES"))
    return {
        "periodo": str(filas["PERIODO"].iloc[0]) if not filas.empty and "PERIODO" in filas else "",
        "maximo": _venta(item, "MAX"),
        "minimo": _venta(item, "MIN"),
        "promedio": promedio,
        "promedio_reciente": reciente,
        # Variacion del promedio reciente frente al del periodo (+0,05 = 5% mas caro ahora)
        "tendencia": reciente / promedio - 1 if promedio and reciente else None,
        "mediana": _num(item.get("PRECIO_MEDIANA")),
        "p25": _num(item.get("PRECIO_P25")),
        "p75": _num(item.get("PRECIO_P75")),
        "ventas": int(_num(item.get("VENTAS")) or 0),
        "clientes": int(clientes) if clientes is not None else int(len(filas)),
        "tramos": tramos_volumen(filas),
    }


def tramos_volumen(filas: pd.DataFrame, n: int = 3) -> list[dict]:
    """Precio promedio que pagan los clientes pequenos, medianos y grandes (por volumen
    mensual): un cliente que compra poco no deberia pagar lo mismo que uno grande."""
    if filas is None or filas.empty or "VOLUMEN_MENSUAL" not in filas:
        return []
    filas = filas[filas["VOLUMEN_MENSUAL"].astype(float) > 0].sort_values("VOLUMEN_MENSUAL")
    if len(filas) < n:
        return []
    tramos = []
    for posiciones in np.array_split(np.arange(len(filas)), n):
        g = filas.iloc[posiciones]
        unidades = g["UNIDADES_PERIODO"].astype(float)
        tramos.append({
            "desde": float(g["VOLUMEN_MENSUAL"].min()),
            "hasta": float(g["VOLUMEN_MENSUAL"].max()),
            "precio": round(float((g["PRECIO_PROMEDIO"].astype(float) * unidades).sum() / unidades.sum()), 2),
            "clientes": int(len(g)),
        })
    return tramos


def precio_del_cliente(catalogo, producto: str, calibre: str, cliente: str) -> dict | None:
    """Lo que este mismo cliente pago por la referencia, si ya la compro."""
    filas = _filas(getattr(catalogo, "precios", None), producto, calibre)
    if filas.empty or not cliente:
        return None
    m = filas[filas["CLIENTE"].astype(str).str.strip().str.upper() == str(cliente).strip().upper()]
    if m.empty:
        return None
    r = m.iloc[0]
    return {
        "ultimo_precio": _num(r["ULTIMO_PRECIO"]), "fecha_ultimo": str(r["FECHA_ULTIMO"]),
        "precio_promedio": _num(r["PRECIO_PROMEDIO"]), "volumen_mensual": _num(r["VOLUMEN_MENSUAL"]),
    }


def referencia_volumen(catalogo, producto: str, calibre: str, cantidad_mes: float) -> dict | None:
    """Precio de mercado para una cantidad: promedio ponderado de clientes de volumen parecido."""
    filas = _filas(getattr(catalogo, "precios", None), producto, calibre)
    cantidad = float(cantidad_mes or 0)
    if not filas.empty and cantidad > 0:
        bajo, alto = RANGO_VOLUMEN
        similares = filas[(filas["VOLUMEN_MENSUAL"] >= cantidad * bajo) & (filas["VOLUMEN_MENSUAL"] <= cantidad * alto)]
        if not similares.empty:
            unidades = similares["UNIDADES_PERIODO"].astype(float)
            precio = float((similares["PRECIO_PROMEDIO"].astype(float) * unidades).sum() / unidades.sum())
            return {"precio": round(precio, 2), "base": "volumen similar", "clientes": int(len(similares))}
    item = _item(catalogo.items, producto, calibre)
    if item is not None:
        precio = _num(item.get("PRECIO_PROM_3M")) or _num(item.get("PRECIO_MEDIANA"))
        if precio:
            return {"precio": precio, "base": "general", "clientes": int(len(filas))}
    return None


def diferencia(precio: float, ref: dict | None) -> float | None:
    """Precio cotizado frente a la referencia: -0,08 = 8% por debajo."""
    if not ref or not ref.get("precio") or not precio:
        return None
    return float(precio) / float(ref["precio"]) - 1
