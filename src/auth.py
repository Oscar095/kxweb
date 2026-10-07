"""Usuario en sesion, roles y usuarios iniciales.

La verificacion de contraseñas vive en `usuarios.py`; aqui solo se define el
usuario que queda en la sesion de Streamlit y los helpers de rol.
"""
from __future__ import annotations

from dataclasses import dataclass

from .config import ROL_GERENTE, ROL_VENDEDOR


@dataclass(frozen=True)
class Usuario:
    nombre: str
    rol: str


# Se crean automaticamente la primera vez, con clave temporal que deben cambiar.
USUARIOS_INICIALES: tuple[tuple[str, str], ...] = (
    ("Carlos Rojas", ROL_GERENTE),  # unico aprobador / gerente
    ("Elena Acosta", ROL_VENDEDOR),
    ("Mauricio Pulido", ROL_VENDEDOR),
)


def es_gerente(usuario: Usuario | None) -> bool:
    return bool(usuario and usuario.rol == ROL_GERENTE)


def es_vendedor(usuario: Usuario | None) -> bool:
    return bool(usuario and usuario.rol == ROL_VENDEDOR)
