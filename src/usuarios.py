"""Usuarios y contraseñas.

- Las contraseñas se guardan con PBKDF2-SHA256 y sal aleatoria, nunca en texto plano.
- Tras MAX_INTENTOS fallos seguidos la cuenta se bloquea MINUTOS_BLOQUEO minutos.
- Una clave temporal (usuario nuevo o restablecido) obliga a crear una propia al entrar.
- Solo el gerente crea vendedores, restablece claves y activa/desactiva cuentas.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import secrets
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from . import database
from .auth import USUARIOS_INICIALES, Usuario
from .config import CLAVES_INICIALES_TXT, DB_PATH, ROL_GERENTE, ROL_VENDEDOR

ITERACIONES = 200_000
MIN_LONGITUD = 8
MAX_INTENTOS = 5
MINUTOS_BLOQUEO = 5
# Sin caracteres que se confunden al dictarlos (0/O, 1/l/I).
_ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
_ERROR_LOGIN = "Usuario o contraseña incorrectos."


def _clave_nombre(nombre: str | None) -> str:
    """Nombre para comparar: sin tildes, sin mayusculas y con espacios simples."""
    t = unicodedata.normalize("NFKD", str(nombre or "")).encode("ascii", "ignore").decode()
    return " ".join(t.casefold().split())
# Vendedores del ERP que el gerente elimino: la importacion no los vuelve a crear.
PARAM_EXCLUIDOS_ERP = "vendedores_erp_excluidos"


# ---------------------------------------------------------------------------
# Hash y validacion
# ---------------------------------------------------------------------------


def hash_password(password: str, *, iteraciones: int = ITERACIONES) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iteraciones)
    return f"pbkdf2_sha256${iteraciones}${salt.hex()}${dk.hex()}"


def verificar_password(password: str, guardado: str) -> bool:
    try:
        algoritmo, iteraciones, salt_hex, hash_hex = guardado.split("$")
        if algoritmo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iteraciones)
        )
    except (ValueError, AttributeError):
        return False
    return hmac.compare_digest(dk.hex(), hash_hex)


def validar_password_nueva(password: str, nombre: str = "") -> str | None:
    """Devuelve el mensaje de error, o None si la contraseña es aceptable."""
    password = password or ""
    if len(password) < MIN_LONGITUD:
        return f"La contraseña debe tener al menos {MIN_LONGITUD} caracteres."
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "La contraseña debe combinar letras y números."
    if nombre and nombre.replace(" ", "").lower() in password.replace(" ", "").lower():
        return "La contraseña no puede contener tu nombre."
    return None


def generar_clave_temporal(longitud: int = 10) -> str:
    while True:
        clave = "".join(secrets.choice(_ALFABETO) for _ in range(longitud))
        if validar_password_nueva(clave) is None:
            return clave


def _ahora() -> str:
    return datetime.now().isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------


def listar_usuarios(*, solo_activos: bool = False, db_path: Path | str = DB_PATH) -> list[dict]:
    """Lista usuarios SIN el hash de la contraseña."""
    sql = (
        "SELECT id, nombre, rol, debe_cambiar, activo, ultimo_ingreso, "
        "bloqueado_hasta, creado_en, nombre_erp FROM usuarios"
    )
    if solo_activos:
        sql += " WHERE activo = 1"
    sql += " ORDER BY CASE rol WHEN 'gerente' THEN 0 ELSE 1 END, nombre"
    with database.conectar(db_path) as c:
        return [dict(r) for r in c.execute(sql)]


def perfil(nombre: str, *, db_path: Path | str = DB_PATH) -> dict:
    """Datos de firma del usuario: nombre, cargo, celular y correo."""
    with database.conectar(db_path) as c:
        row = c.execute(
            "SELECT nombre, rol, cargo, celular, correo, nombre_erp FROM usuarios WHERE nombre = ?", (nombre,)
        ).fetchone()
    if row is None:
        return {"nombre": nombre, "rol": "", "cargo": "", "celular": "", "correo": "", "nombre_erp": ""}
    return {k: (row[k] or "") for k in ("nombre", "rol", "cargo", "celular", "correo", "nombre_erp")}


def actualizar_perfil(
    nombre: str, *, cargo: str = "", celular: str = "", correo: str = "",
    db_path: Path | str = DB_PATH,
) -> None:
    correo = (correo or "").strip()
    if correo and ("@" not in correo or " " in correo):
        raise ValueError("El correo no es válido.")
    with database.conectar(db_path) as c:
        c.execute(
            "UPDATE usuarios SET cargo = ?, celular = ?, correo = ?, actualizado_en = ? WHERE nombre = ?",
            (" ".join((cargo or "").split()), " ".join((celular or "").split()), correo, _ahora(), nombre),
        )


def renombrar(viejo: str, nuevo: str, *, db_path: Path | str = DB_PATH) -> None:
    """Cambia el nombre de un usuario conservando su clave y su historial."""
    nuevo = " ".join((nuevo or "").split())
    if not nuevo:
        raise ValueError("El nombre nuevo es obligatorio.")
    with database.conectar(db_path) as c:
        if c.execute("SELECT 1 FROM usuarios WHERE nombre = ?", (viejo,)).fetchone() is None:
            raise ValueError(f"No existe el usuario '{viejo}'.")
        if c.execute("SELECT 1 FROM usuarios WHERE lower(nombre) = lower(?) AND nombre <> ?",
                     (nuevo, viejo)).fetchone():
            raise ValueError(f"Ya existe un usuario llamado '{nuevo}'.")
        c.execute("UPDATE usuarios SET nombre = ?, actualizado_en = ? WHERE nombre = ?", (nuevo, _ahora(), viejo))
        c.execute("UPDATE cotizaciones SET vendedor = ? WHERE vendedor = ?", (nuevo, viejo))
        c.execute("UPDATE seguimientos SET creado_por = ? WHERE creado_por = ?", (nuevo, viejo))
        c.execute("UPDATE aprobaciones SET usuario = ? WHERE usuario = ?", (nuevo, viejo))
        c.execute("UPDATE clientes SET creado_por = ? WHERE creado_por = ?", (nuevo, viejo))


def esta_activo(nombre: str, *, db_path: Path | str = DB_PATH) -> bool:
    with database.conectar(db_path) as c:
        row = c.execute("SELECT activo FROM usuarios WHERE nombre = ?", (nombre,)).fetchone()
    return bool(row and row["activo"])


# ---------------------------------------------------------------------------
# Alta, login y cambios
# ---------------------------------------------------------------------------


def crear_usuario(
    nombre: str,
    rol: str,
    password: str,
    *,
    debe_cambiar: bool = True,
    db_path: Path | str = DB_PATH,
) -> int:
    nombre = " ".join((nombre or "").split())
    if not nombre:
        raise ValueError("El nombre es obligatorio.")
    if rol not in (ROL_VENDEDOR, ROL_GERENTE):
        raise ValueError("Rol inválido.")
    with database.conectar(db_path) as c:
        if c.execute(
            "SELECT 1 FROM usuarios WHERE lower(nombre) = lower(?)", (nombre,)
        ).fetchone():
            raise ValueError(f"Ya existe un usuario llamado '{nombre}'.")
        ahora = _ahora()
        cur = c.execute(
            "INSERT INTO usuarios(nombre, rol, password_hash, debe_cambiar, activo, "
            "creado_en, actualizado_en) VALUES (?,?,?,?,1,?,?)",
            (nombre, rol, hash_password(password), 1 if debe_cambiar else 0, ahora, ahora),
        )
        return int(cur.lastrowid)


def crear_vendedor(nombre: str, *, nombre_erp: str | None = None, db_path: Path | str = DB_PATH) -> str:
    """Crea un vendedor con clave temporal y la devuelve para entregarla."""
    clave = generar_clave_temporal()
    crear_usuario(nombre, ROL_VENDEDOR, clave, debe_cambiar=True, db_path=db_path)
    if nombre_erp:
        asignar_nombre_erp(" ".join(nombre.split()), nombre_erp, db_path=db_path)
    return clave


def nombre_corto(nombre_erp: str) -> str:
    """'CLAVIJO MINOTTA JOHAN DAVID' -> 'Johan Clavijo' (nombre y primer apellido).

    El ERP escribe apellidos primero. Con 4 o mas palabras se toman las dos
    ultimas como nombres; con menos, solo la ultima.
    """
    palabras = (nombre_erp or "").split()
    if len(palabras) < 2:
        return (nombre_erp or "").strip().title()
    nombres = palabras[-2:] if len(palabras) >= 4 else palabras[-1:]
    return f"{nombres[0].title()} {palabras[0].title()}"


def asignar_nombre_erp(nombre: str, nombre_erp: str | None, *, db_path: Path | str = DB_PATH) -> None:
    with database.conectar(db_path) as c:
        c.execute("UPDATE usuarios SET nombre_erp = ?, actualizado_en = ? WHERE nombre = ?",
                  (nombre_erp, _ahora(), nombre))


def tiene_historial(nombre: str, *, db_path: Path | str = DB_PATH) -> bool:
    with database.conectar(db_path) as c:
        for tabla, columna in (("cotizaciones", "vendedor"), ("aprobaciones", "usuario"),
                               ("seguimientos", "creado_por")):
            if c.execute(f"SELECT 1 FROM {tabla} WHERE {columna} = ? LIMIT 1", (nombre,)).fetchone():
                return True
    return False


def excluidos_erp(*, db_path: Path | str = DB_PATH) -> list[str]:
    try:
        return json.loads(database.obtener_parametro(PARAM_EXCLUIDOS_ERP, "[]", db_path=db_path))
    except ValueError:
        return []


def eliminar(nombre: str, *, quien: str = "", db_path: Path | str = DB_PATH) -> None:
    """Elimina un usuario sin historial. Si venia del ERP, no se vuelve a crear al importar."""
    with database.conectar(db_path) as c:
        row = c.execute("SELECT rol, nombre_erp FROM usuarios WHERE nombre = ?", (nombre,)).fetchone()
    if row is None:
        raise ValueError("Usuario no encontrado.")
    if row["rol"] == ROL_GERENTE:
        raise ValueError("No se puede eliminar al gerente.")
    if tiene_historial(nombre, db_path=db_path):
        raise ValueError("Tiene cotizaciones o registros: desactívalo en lugar de eliminarlo.")
    if row["nombre_erp"]:
        excluidos = excluidos_erp(db_path=db_path)
        if row["nombre_erp"] not in excluidos:
            database.guardar_parametro(PARAM_EXCLUIDOS_ERP, json.dumps(excluidos + [row["nombre_erp"]]),
                                       quien or "sistema", db_path=db_path)
    with database.conectar(db_path) as c:
        c.execute("DELETE FROM usuarios WHERE nombre = ?", (nombre,))


@dataclass
class ResultadoLogin:
    usuario: Usuario | None
    debe_cambiar: bool = False
    error: str = ""


def autenticar(
    nombre: str,
    password: str,
    *,
    db_path: Path | str = DB_PATH,
    ahora: datetime | None = None,
) -> ResultadoLogin:
    ahora = ahora or datetime.now()
    with database.conectar(db_path) as c:
        row = c.execute("SELECT * FROM usuarios WHERE nombre = ?", (nombre,)).fetchone()
        if row is None:
            # El usuario se escribe a mano: 'elena acosta' o 'Elena  Acosta' tambien valen.
            clave = _clave_nombre(nombre)
            row = next((r for r in c.execute("SELECT * FROM usuarios") if _clave_nombre(r["nombre"]) == clave), None)
        if row is None or not row["activo"]:
            return ResultadoLogin(None, error=_ERROR_LOGIN)

        if row["bloqueado_hasta"]:
            hasta = datetime.fromisoformat(row["bloqueado_hasta"])
            if ahora < hasta:
                minutos = max(1, math.ceil((hasta - ahora).total_seconds() / 60))
                return ResultadoLogin(
                    None,
                    error=f"Cuenta bloqueada por intentos fallidos. Intenta de nuevo en {minutos} min.",
                )

        if not verificar_password(password or "", row["password_hash"]):
            intentos = int(row["intentos_fallidos"] or 0) + 1
            bloqueado_hasta = None
            if intentos >= MAX_INTENTOS:
                bloqueado_hasta = (ahora + timedelta(minutes=MINUTOS_BLOQUEO)).isoformat(
                    timespec="seconds"
                )
                intentos = 0
            c.execute(
                "UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?",
                (intentos, bloqueado_hasta, row["id"]),
            )
            if bloqueado_hasta:
                return ResultadoLogin(
                    None,
                    error=f"Demasiados intentos fallidos. Cuenta bloqueada {MINUTOS_BLOQUEO} minutos.",
                )
            return ResultadoLogin(None, error=_ERROR_LOGIN)

        c.execute(
            "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, "
            "ultimo_ingreso = ? WHERE id = ?",
            (ahora.isoformat(timespec="seconds"), row["id"]),
        )
        return ResultadoLogin(
            Usuario(row["nombre"], row["rol"]), debe_cambiar=bool(row["debe_cambiar"])
        )


def cambiar_password(
    nombre: str,
    nueva: str,
    *,
    actual: str | None = None,
    db_path: Path | str = DB_PATH,
) -> None:
    """Cambia la contraseña. Si se pasa `actual`, se verifica primero."""
    error = validar_password_nueva(nueva, nombre)
    if error:
        raise ValueError(error)
    with database.conectar(db_path) as c:
        row = c.execute(
            "SELECT id, password_hash FROM usuarios WHERE nombre = ?", (nombre,)
        ).fetchone()
        if row is None:
            raise ValueError("Usuario no encontrado.")
        if actual is not None and not verificar_password(actual, row["password_hash"]):
            raise ValueError("La contraseña actual no es correcta.")
        if verificar_password(nueva, row["password_hash"]):
            raise ValueError("La nueva contraseña debe ser distinta de la anterior.")
        c.execute(
            "UPDATE usuarios SET password_hash = ?, debe_cambiar = 0, actualizado_en = ? "
            "WHERE id = ?",
            (hash_password(nueva), _ahora(), row["id"]),
        )


def restablecer_password(nombre: str, *, db_path: Path | str = DB_PATH) -> str:
    """Asigna una clave temporal (y desbloquea la cuenta). Devuelve la clave."""
    clave = generar_clave_temporal()
    with database.conectar(db_path) as c:
        cur = c.execute(
            "UPDATE usuarios SET password_hash = ?, debe_cambiar = 1, intentos_fallidos = 0, "
            "bloqueado_hasta = NULL, actualizado_en = ? WHERE nombre = ?",
            (hash_password(clave), _ahora(), nombre),
        )
        if cur.rowcount == 0:
            raise ValueError("Usuario no encontrado.")
    return clave


def establecer_activo(nombre: str, activo: bool, *, db_path: Path | str = DB_PATH) -> None:
    with database.conectar(db_path) as c:
        row = c.execute("SELECT rol FROM usuarios WHERE nombre = ?", (nombre,)).fetchone()
        if row is None:
            raise ValueError("Usuario no encontrado.")
        if not activo and row["rol"] == ROL_GERENTE:
            gerentes = c.execute(
                "SELECT COUNT(*) AS n FROM usuarios WHERE rol = ? AND activo = 1",
                (ROL_GERENTE,),
            ).fetchone()["n"]
            if gerentes <= 1:
                raise ValueError("Debe quedar al menos un gerente activo.")
        c.execute(
            "UPDATE usuarios SET activo = ?, actualizado_en = ? WHERE nombre = ?",
            (1 if activo else 0, _ahora(), nombre),
        )


def asegurar_usuarios_iniciales(
    *,
    db_path: Path | str = DB_PATH,
    archivo: Path | str | None = CLAVES_INICIALES_TXT,
) -> dict[str, str]:
    """Primera vez (base sin usuarios): crea los usuarios iniciales y anota sus claves.

    Si ya hay usuarios no hace nada, aunque falte alguno de la lista inicial: los
    vendedores se administran desde la app o con la importacion del ERP.
    Devuelve {nombre: clave} de los creados en esta llamada.
    """
    if listar_usuarios(db_path=db_path):
        return {}
    existentes: set[str] = set()
    nuevas: dict[str, str] = {}
    roles: dict[str, str] = {}
    for nombre, rol in USUARIOS_INICIALES:
        if nombre.lower() in existentes:
            continue
        clave = generar_clave_temporal()
        crear_usuario(nombre, rol, clave, debe_cambiar=True, db_path=db_path)
        nuevas[nombre] = clave
        roles[nombre] = rol

    if nuevas and archivo is not None:
        ruta = Path(archivo)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        with open(ruta, "a", encoding="utf-8") as f:
            f.write(
                f"Claves temporales del Cotizador Kos (creadas {_ahora().replace('T', ' ')})\n"
                "Cada persona debe cambiarla la primera vez que entre.\n"
                "Entregalas en privado y borra este archivo despues.\n\n"
            )
            for nombre, clave in nuevas.items():
                f.write(f"{nombre} ({roles[nombre]}): {clave}\n")
            f.write("\n")
    return nuevas
