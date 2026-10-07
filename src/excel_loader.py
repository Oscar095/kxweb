"""Lectura del Excel maestro (catalogo.xlsx).

Hojas esperadas (todas opcionales salvo Items):
    - Items         : Catalogo de productos (DESCRIPCION, CALIBRE, ...)
    - Materiales    : Costo por tipo de material (POLYBOARD, KRAFT, ...)
    - Costos        : MOD + CIF por grupo de maquina
    - FLETE         : Tabla de fletes
    - Clientes      : Maestro de clientes
    - Politica      : umbral_comercial / umbral_financiero (gerente)

Si una hoja no existe se usan defaults documentados. La idea es que el negocio
pueda actualizar el Excel sin romper la aplicacion.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd

from .config import CATALOGO_XLSX, POLITICA_DEFAULT, PoliticaMargen


@dataclass
class CatalogoData:
    items: pd.DataFrame
    materiales: pd.DataFrame
    costos_grupo: pd.DataFrame
    flete: pd.DataFrame
    clientes: pd.DataFrame
    politica: PoliticaMargen
    # Referencia de precios reales por cliente (hoja PreciosClientes, opcional)
    precios: pd.DataFrame = field(default_factory=pd.DataFrame)


def _read_sheet(path: Path, sheet: str) -> Optional[pd.DataFrame]:
    try:
        return pd.read_excel(path, sheet_name=sheet)
    except (ValueError, FileNotFoundError):
        return None


def _normalize_cols(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _safe_sheet(path: Path, sheet: str) -> pd.DataFrame:
    df = _read_sheet(path, sheet)
    if df is None:
        return pd.DataFrame()
    return _normalize_cols(df)


def cargar_catalogo(path: Path | str = CATALOGO_XLSX) -> CatalogoData:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(
            f"No se encontro el catalogo en {p}. Genere la plantilla con "
            f"`python -m src.bootstrap_xlsx`."
        )

    items = _safe_sheet(p, "Items")
    materiales = _safe_sheet(p, "Materiales")
    costos_grupo = _safe_sheet(p, "Costos")
    flete = _safe_sheet(p, "FLETE")
    clientes = _safe_sheet(p, "Clientes")
    precios = _safe_sheet(p, "PreciosClientes")

    politica = POLITICA_DEFAULT
    pol_df = _read_sheet(p, "Politica")
    if pol_df is not None and not pol_df.empty:
        pol_df = _normalize_cols(pol_df)
        try:
            row = pol_df.iloc[0]
            uf = float(row.get("umbral_financiero", politica.umbral_financiero))
            uc = float(row.get("umbral_comercial", politica.umbral_comercial))
            politica = PoliticaMargen(umbral_financiero=uf, umbral_comercial=uc)
        except (ValueError, TypeError, KeyError):
            pass

    return CatalogoData(
        items=items,
        materiales=materiales,
        costos_grupo=costos_grupo,
        flete=flete,
        clientes=clientes,
        politica=politica,
        precios=precios,
    )


def calcular_costo_item(
    item_row: pd.Series,
    materiales: pd.DataFrame,
    costos_grupo: pd.DataFrame,
) -> Optional[float]:
    """Costo unitario interno de un item del catalogo.

    Estimacion simple: costo_material = (gramaje/1000) * costo_real_kg + (cinta/1000)*...
    Para el MVP confiamos en un campo precalculado `COSTO` si existe en `Items`;
    si no, intentamos estimar con material + MOD + CIF del grupo.
    """
    if "COSTO" in item_row and pd.notna(item_row["COSTO"]):
        try:
            return float(item_row["COSTO"])
        except (TypeError, ValueError):
            pass

    gramaje = float(item_row.get("GRAMAJE", 0) or 0)
    material = str(item_row.get("Material", "") or "").strip().upper()

    costo_kg = 0.0
    if not materiales.empty and "Material" in materiales.columns:
        m = materiales[materiales["Material"].astype(str).str.strip().str.upper() == material]
        if not m.empty:
            for col in ("Costo Real", "Costo"):
                if col in m.columns and pd.notna(m.iloc[0].get(col)):
                    costo_kg = float(m.iloc[0][col])
                    break

    costo_material = (gramaje / 1000.0) * costo_kg if gramaje and costo_kg else 0.0

    grupo = str(item_row.get("GRUPO", "") or "").strip().upper()
    mod = cif = 0.0
    if not costos_grupo.empty and "Grupo" in costos_grupo.columns:
        g = costos_grupo[costos_grupo["Grupo"].astype(str).str.strip().str.upper() == grupo]
        if not g.empty:
            mod = float(g.iloc[0].get("MOD", 0) or 0)
            cif = float(g.iloc[0].get("CIF", 0) or 0)

    total = costo_material + mod + cif
    return total if total > 0 else None


def calibres_de_producto(items: pd.DataFrame, descripcion: str) -> list[str]:
    """Calibres disponibles para un producto."""
    if items.empty or not descripcion:
        return []
    m = items[items["DESCRIPCION"].astype(str) == str(descripcion)]
    if m.empty:
        return []
    return sorted(m["CALIBRE"].dropna().astype(str).unique().tolist())


def empaque_de(items: pd.DataFrame, descripcion: str, calibre: str) -> int | None:
    """Empaque (Und Empaque) del catalogo segun producto + calibre."""
    if items.empty or not descripcion or not calibre:
        return None
    m = items[
        (items["DESCRIPCION"].astype(str) == str(descripcion))
        & (items["CALIBRE"].astype(str) == str(calibre))
    ]
    if m.empty or "Und Empaque" not in m.columns:
        return None
    val = m.iloc[0].get("Und Empaque")
    try:
        return int(val) if pd.notna(val) else None
    except (TypeError, ValueError):
        return None


def flete_unitario(flete: pd.DataFrame, rubro: str = "FLETE") -> float:
    """Por simplicidad MVP: un valor unico de flete por unidad."""
    if flete.empty:
        return 0.0
    if "RUBRO" in flete.columns and "PRECIO" in flete.columns:
        m = flete[flete["RUBRO"].astype(str).str.strip().str.upper() == rubro.upper()]
        if not m.empty:
            try:
                return float(m.iloc[0]["PRECIO"])
            except (TypeError, ValueError):
                return 0.0
    return 0.0
