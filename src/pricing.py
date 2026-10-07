"""Calculo de margen bruto (UB%), totales y politica de aprobacion.

Reglas de negocio:
    costo_total_unit = costo_unit + flete_unit
    ub_pct = (precio - costo_total_unit) / precio        si precio > 0
    venta_total = precio * cantidad_mes / empaque        (cantidad_mes esta en unidades)
    margen_dinero = (precio - costo_total_unit) * (cantidad_mes / empaque)

NOTA: En el Excel real, `cantidad mes` ya viene en unidades y precio es por unidad
de empaque (caja de 1000). Para el MVP normalizamos asi:
    - Precio: por unidad fisica (vaso).
    - Cantidad mes: cantidad de unidades fisicas vendidas al mes.
    - venta_total = precio * cantidad_mes
Documentado tambien en docs/B_tecnico.md.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .config import POLITICA_DEFAULT, PoliticaMargen

APROB_OK = ""
APROB_COMERCIAL = "Requiere aprobacion comercial"
APROB_COMERCIAL_FIN = "Requiere aprobacion comercial y financiera"


@dataclass
class LineaCalculo:
    precio: float
    costo_unit: float
    flete_unit: float
    cantidad_mes: float

    @property
    def costo_total_unit(self) -> float:
        return self.costo_unit + self.flete_unit

    @property
    def ub_pct(self) -> Optional[float]:
        if self.precio is None or self.precio <= 0:
            return None
        return (self.precio - self.costo_total_unit) / self.precio

    @property
    def venta_total(self) -> float:
        if self.precio is None or self.cantidad_mes is None:
            return 0.0
        return float(self.precio) * float(self.cantidad_mes)

    @property
    def margen_dinero(self) -> float:
        if self.precio is None or self.cantidad_mes is None:
            return 0.0
        return (self.precio - self.costo_total_unit) * float(self.cantidad_mes)


def calcular_ub_pct(precio: float, costo_unit: float, flete_unit: float = 0.0) -> Optional[float]:
    """Margen bruto fraccional (0.20 = 20%). None si precio <= 0."""
    if precio is None or precio <= 0:
        return None
    return (precio - (costo_unit + flete_unit)) / precio


def estado_aprobacion(
    ub_pct: Optional[float], politica: PoliticaMargen = POLITICA_DEFAULT
) -> str:
    """Texto canonico de la columna 'Aprobacion' segun politica."""
    if ub_pct is None:
        return ""
    if ub_pct < politica.umbral_financiero:
        return APROB_COMERCIAL_FIN
    if ub_pct < politica.umbral_comercial:
        return APROB_COMERCIAL
    return APROB_OK


def requiere_aprobacion(ub_pct: Optional[float], politica: PoliticaMargen = POLITICA_DEFAULT) -> bool:
    return estado_aprobacion(ub_pct, politica) != APROB_OK


def nivel_aprobacion(ub_pct: Optional[float], politica: PoliticaMargen = POLITICA_DEFAULT) -> int:
    """0 = sin aprobacion; 1 = comercial; 2 = comercial + financiera."""
    if ub_pct is None:
        return 0
    if ub_pct < politica.umbral_financiero:
        return 2
    if ub_pct < politica.umbral_comercial:
        return 1
    return 0


# Estados validos para que el VENDEDOR pueda generar PDF de oferta:
# - Si la cotizacion requiere aprobacion, solo se permite cuando ya fue aprobada
#   por el gerente (estado aprobada / enviada / ganada / perdida / en_negociacion).
# - Si no requiere aprobacion, se permite siempre que no este rechazada.
_ESTADOS_POST_APROBACION = frozenset(
    {"aprobada", "enviada", "ganada", "perdida", "en_negociacion"}
)


def puede_generar_pdf(estado: str, requiere_aprobacion_alguna_linea: bool) -> tuple[bool, str]:
    """Indica si se permite generar PDF + razon legible si no se permite."""
    if estado == "rechazada":
        return False, "La cotizacion fue rechazada; no se puede generar PDF."
    if requiere_aprobacion_alguna_linea and estado not in _ESTADOS_POST_APROBACION:
        return False, "Hay lineas que requieren aprobacion del gerente. Solo se puede generar PDF una vez aprobada."
    return True, ""
