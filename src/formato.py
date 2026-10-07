"""Helpers de formato numerico estilo Colombia/es-ES.

Miles con punto, decimales con coma. Funciones pequenas y testeables.
"""
from __future__ import annotations


def fmt_miles(valor: float | int | None, decimales: int = 0) -> str:
    if valor is None or valor == "":
        return ""
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return str(valor)
    s = f"{n:,.{decimales}f}"
    # Python entrega 1,234.56 -> queremos 1.234,56
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return s


def fmt_moneda(valor: float | int | None, decimales: int = 0, simbolo: str = "$") -> str:
    if valor is None:
        return ""
    return f"{simbolo} {fmt_miles(valor, decimales)}"


def fmt_usd(valor: float | int | None, decimales: int = 3) -> str:
    """Formato 'USD 1.234,567' siguiendo locale es-CO (miles . / decimales ,)."""
    if valor is None:
        return ""
    return f"USD {fmt_miles(valor, decimales)}"


def fmt_porcentaje(valor: float | None, decimales: int = 2) -> str:
    """Recibe fraccion (0.123) y devuelve '12,30%'."""
    if valor is None:
        return ""
    try:
        pct = float(valor) * 100.0
    except (TypeError, ValueError):
        return str(valor)
    s = f"{pct:.{decimales}f}".replace(".", ",")
    return f"{s}%"
