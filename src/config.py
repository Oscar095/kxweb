"""Configuracion central del cotizador.

Convenciones:
- Costos y umbrales SOLO se referencian desde rutas server-side.
- Identificadores en codigo en ingles minimalista (snake_case); UI en espanol.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT_DIR: Path = Path(__file__).resolve().parents[1]
# COTIZADOR_DATA: carpeta de datos (base, catalogo, informes). En Azure va en el
# almacenamiento permanente (/home/...), fuera del contenedor.
DATA_DIR: Path = Path(os.environ.get("COTIZADOR_DATA") or ROOT_DIR / "data")
# COTIZADOR_DB / COTIZADOR_SALIDAS permiten correr una copia aparte (pruebas).
SALIDAS_DIR: Path = Path(os.environ.get("COTIZADOR_SALIDAS") or ROOT_DIR / "salidas")
DB_PATH: Path = Path(os.environ.get("COTIZADOR_DB") or DATA_DIR / "cotizador.db")
CATALOGO_XLSX: Path = DATA_DIR / "catalogo.xlsx"
# Claves temporales de los usuarios iniciales, junto a la base. Solo se escribe
# al crearlos; se recomienda borrarlo una vez entregadas.
CLAVES_INICIALES_TXT: Path = DB_PATH.parent / "claves_iniciales.txt"

DATA_DIR.mkdir(parents=True, exist_ok=True)
SALIDAS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class PoliticaMargen:
    """Politica de UB% configurable por el gerente.

    umbral_comercial: por debajo => requiere aprobacion comercial.
    umbral_financiero: por debajo => requiere aprobacion comercial Y financiera.
    Estos valores son los DEFAULT iniciales; el gerente puede editarlos en BD.
    """

    umbral_financiero: float = 0.10  # 10% UB
    umbral_comercial: float = 0.20   # 20% UB


POLITICA_DEFAULT = PoliticaMargen()

# Moneda y locale visual
MONEDA = "COP"
LOCALE_MILES = "."
LOCALE_DECIMAL = ","

# Estados de cotizacion (embudo)
ESTADO_BORRADOR = "borrador"
ESTADO_PENDIENTE_APROBACION = "pendiente_aprobacion"
ESTADO_APROBADA = "aprobada"
ESTADO_RECHAZADA = "rechazada"
ESTADO_ENVIADA = "enviada"
ESTADO_GANADA = "ganada"
ESTADO_PERDIDA = "perdida"
ESTADO_NEGOCIACION = "en_negociacion"

ESTADOS_POST_ENVIO = (ESTADO_GANADA, ESTADO_PERDIDA, ESTADO_NEGOCIACION)
ESTADOS_TODOS = (
    ESTADO_BORRADOR,
    ESTADO_PENDIENTE_APROBACION,
    ESTADO_APROBADA,
    ESTADO_RECHAZADA,
    ESTADO_ENVIADA,
    ESTADO_GANADA,
    ESTADO_PERDIDA,
    ESTADO_NEGOCIACION,
)

# Nombres legibles para la UI (la BD guarda el codigo interno).
ESTADO_LABEL = {
    ESTADO_BORRADOR: "Borrador",
    ESTADO_PENDIENTE_APROBACION: "En aprobación",
    ESTADO_APROBADA: "Aprobada",
    ESTADO_RECHAZADA: "Rechazada",
    ESTADO_ENVIADA: "Enviada",
    ESTADO_NEGOCIACION: "En negociación",
    ESTADO_GANADA: "Ganada",
    ESTADO_PERDIDA: "Perdida",
}


def estado_label(estado: str | None) -> str:
    return ESTADO_LABEL.get(estado or "", estado or "")


# Canales comerciales. Expo es exportacion: oferta en dolares con TRM.
CANALES = ("Distri", "Horeca", "Expo", "KA", "Medianos", "KX")
CANAL_EXPORTACION = "Expo"
# Nombres anteriores del mismo canal (cotizaciones viejas)
_CANALES_ANTERIORES = {"exportaciones": CANAL_EXPORTACION}


def canal_vigente(canal: str | None) -> str | None:
    """'Exportaciones' (nombre anterior) -> 'Expo'; un canal que ya no existe -> None."""
    texto = str(canal or "").strip()
    if texto in CANALES:
        return texto
    return _CANALES_ANTERIORES.get(texto.lower())


def es_exportacion(canal: str | None) -> bool:
    return canal_vigente(canal) == CANAL_EXPORTACION

# Roles MVP (mock; no es seguridad de produccion)
ROL_VENDEDOR = "vendedor"
ROL_GERENTE = "gerente"
ROLES = (ROL_VENDEDOR, ROL_GERENTE)

# Categorias de retroalimentacion del cliente
CATEGORIAS_FEEDBACK = (
    "precio",
    "plazo_entrega",
    "competencia",
    "especificacion",
    "calidad",
    "otro",
)

# Motivos cerrados de PERDIDA (obligatorios cuando se marca estado=perdida).
# Si se elige `otro`, el usuario debe especificar texto libre adicional.
MOTIVOS_PERDIDA = (
    "precio",
    "tiempos_de_entrega",
    "cantidades_minimas",
    "fletes",
    "falta_interes_cliente",
    "calidad",
    "otro",
)
MOTIVO_PERDIDA_OTRO = "otro"


@dataclass
class AppConfig:
    politica: PoliticaMargen = field(default_factory=PoliticaMargen)
    catalogo_xlsx: Path = CATALOGO_XLSX
    db_path: Path = DB_PATH
