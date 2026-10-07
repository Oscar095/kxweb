"""Persistencia SQLite. Esquema minimo para MVP con trazabilidad y auditoria.

Tablas:
    clientes        Maestro de clientes (incluye 'cliente nuevo' creado por vendedor)
    cotizaciones    Cabecera (id, fecha, vendedor, cliente, estado, totales)
    lineas          Detalle por cotizacion (producto, calibre, precio, costo, ub%, aprob)
    aprobaciones    Auditoria de aprobaciones (quien, cuando, decision, motivo)
    seguimientos    Resultado post-envio (ganada/perdida/negociacion) + feedback
    politica        Umbrales editables por gerente (persistencia en BD)

NOTA: Para el MVP la columna `costo_unit` se guarda y solo se expone en sesion
gerente. La capa de UI debe filtrar costos en la sesion vendedor.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from .config import (
    DB_PATH,
    ESTADO_BORRADOR,
    POLITICA_DEFAULT,
    PoliticaMargen,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS clientes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    contacto    TEXT,
    ciudad      TEXT,
    segmento    TEXT,
    es_nuevo    INTEGER DEFAULT 0,
    creado_en   TEXT NOT NULL,
    creado_por  TEXT
);

CREATE TABLE IF NOT EXISTS cotizaciones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo          TEXT UNIQUE NOT NULL,
    fecha           TEXT NOT NULL,
    vendedor        TEXT NOT NULL,
    cliente_id      INTEGER NOT NULL,
    canal           TEXT,
    condiciones_pago TEXT,
    vigencia_dias   INTEGER DEFAULT 15,
    tiempo_entrega  TEXT,
    estado          TEXT NOT NULL DEFAULT 'borrador',
    notas           TEXT,
    flete_adicional REAL DEFAULT 0,
    trm             REAL,           -- solo se usa en el canal de exportacion (Expo)
    cliente_es_nuevo INTEGER DEFAULT 0,  -- snapshot al momento de la cotizacion
    actualizado_en  TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS lineas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cotizacion_id   INTEGER NOT NULL,
    orden           INTEGER NOT NULL,
    producto        TEXT NOT NULL,
    calibre         TEXT,
    impreso         TEXT,
    empaque         INTEGER,
    cantidad_mes   REAL,
    precio          REAL,
    costo_unit      REAL,         -- INTERNO: solo gerente
    flete_unit      REAL DEFAULT 0,
    ub_pct          REAL,
    aprobacion_txt  TEXT,
    aprobada        INTEGER DEFAULT 0,
    aprobada_por    TEXT,
    aprobada_en     TEXT,
    FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aprobaciones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cotizacion_id   INTEGER NOT NULL,
    linea_id        INTEGER,
    decision        TEXT NOT NULL,    -- aprobada | rechazada
    motivo          TEXT,
    usuario         TEXT NOT NULL,
    creado_en       TEXT NOT NULL,
    FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seguimientos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cotizacion_id   INTEGER NOT NULL,
    estado          TEXT NOT NULL,    -- ganada | perdida | en_negociacion
    motivo          TEXT,
    categoria_feedback TEXT,
    feedback_cliente TEXT,
    fecha_cierre    TEXT,
    creado_en       TEXT NOT NULL,
    creado_por      TEXT,
    FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS politica (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    umbral_comercial REAL NOT NULL,
    umbral_financiero REAL NOT NULL,
    actualizado_por TEXT,
    actualizado_en  TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre            TEXT UNIQUE NOT NULL,   -- tambien es el 'vendedor' de cotizaciones
    rol               TEXT NOT NULL,          -- vendedor | gerente
    password_hash     TEXT NOT NULL,          -- pbkdf2_sha256$iter$salt$hash
    debe_cambiar      INTEGER DEFAULT 1,      -- 1 = clave temporal, cambiar al entrar
    activo            INTEGER DEFAULT 1,
    intentos_fallidos INTEGER DEFAULT 0,
    bloqueado_hasta   TEXT,
    ultimo_ingreso    TEXT,
    creado_en         TEXT NOT NULL,
    actualizado_en    TEXT
);

CREATE TABLE IF NOT EXISTS parametros (
    clave           TEXT PRIMARY KEY,
    valor           TEXT,
    actualizado_por TEXT,
    actualizado_en  TEXT
);
"""


@contextmanager
def conectar(db_path: Path | str = DB_PATH):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def inicializar(db_path: Path | str = DB_PATH, politica: PoliticaMargen = POLITICA_DEFAULT) -> None:
    """Crea tablas y precarga politica si no existe. Aplica migraciones idempotentes."""
    with conectar(db_path) as c:
        c.executescript(SCHEMA)
        # Migraciones idempotentes (BDs creadas antes).
        for ddl in (
            "ALTER TABLE cotizaciones ADD COLUMN flete_adicional REAL DEFAULT 0",
            "ALTER TABLE cotizaciones ADD COLUMN trm REAL",
            "ALTER TABLE cotizaciones ADD COLUMN cliente_es_nuevo INTEGER DEFAULT 0",
            "ALTER TABLE usuarios ADD COLUMN cargo TEXT",
            "ALTER TABLE usuarios ADD COLUMN celular TEXT",
            "ALTER TABLE usuarios ADD COLUMN correo TEXT",
            "ALTER TABLE clientes ADD COLUMN activo INTEGER DEFAULT 1",
            "ALTER TABLE usuarios ADD COLUMN nombre_erp TEXT",
            # Control del registro de precios en el ERP: cuando y quien envio el correo.
            "ALTER TABLE cotizaciones ADD COLUMN erp_correo_en TEXT",
            "ALTER TABLE cotizaciones ADD COLUMN erp_correo_por TEXT",
        ):
            try:
                c.execute(ddl)
            except sqlite3.OperationalError:
                pass  # columna ya existe
        row = c.execute("SELECT id FROM politica WHERE id=1").fetchone()
        if row is None:
            c.execute(
                "INSERT INTO politica(id, umbral_comercial, umbral_financiero, "
                "actualizado_por, actualizado_en) VALUES (1, ?, ?, ?, ?)",
                (
                    politica.umbral_comercial,
                    politica.umbral_financiero,
                    "sistema",
                    datetime.now().isoformat(timespec="seconds"),
                ),
            )


def obtener_parametro(clave: str, defecto: str = "", db_path: Path | str = DB_PATH) -> str:
    with conectar(db_path) as c:
        row = c.execute("SELECT valor FROM parametros WHERE clave = ?", (clave,)).fetchone()
    return row["valor"] if row and row["valor"] is not None else defecto


def guardar_parametro(clave: str, valor: str, usuario: str, db_path: Path | str = DB_PATH) -> None:
    with conectar(db_path) as c:
        c.execute(
            "INSERT INTO parametros(clave, valor, actualizado_por, actualizado_en) VALUES (?,?,?,?) "
            "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, "
            "actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en",
            (clave, valor, usuario, datetime.now().isoformat(timespec="seconds")),
        )


def obtener_politica(db_path: Path | str = DB_PATH) -> PoliticaMargen:
    with conectar(db_path) as c:
        row = c.execute(
            "SELECT umbral_comercial, umbral_financiero FROM politica WHERE id=1"
        ).fetchone()
        if row is None:
            return POLITICA_DEFAULT
        return PoliticaMargen(
            umbral_financiero=float(row["umbral_financiero"]),
            umbral_comercial=float(row["umbral_comercial"]),
        )


def actualizar_politica(
    umbral_comercial: float,
    umbral_financiero: float,
    usuario: str,
    db_path: Path | str = DB_PATH,
) -> None:
    with conectar(db_path) as c:
        c.execute(
            "UPDATE politica SET umbral_comercial=?, umbral_financiero=?, "
            "actualizado_por=?, actualizado_en=? WHERE id=1",
            (
                float(umbral_comercial),
                float(umbral_financiero),
                usuario,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )


# ---------- Clientes ----------


def crear_cliente(
    nombre: str,
    contacto: str = "",
    ciudad: str = "",
    segmento: str = "",
    es_nuevo: bool = False,
    creado_por: str = "",
    db_path: Path | str = DB_PATH,
) -> int:
    nombre = (nombre or "").strip()
    if not nombre:
        raise ValueError("El nombre del cliente es obligatorio.")
    with conectar(db_path) as c:
        cur = c.execute(
            "INSERT INTO clientes(nombre, contacto, ciudad, segmento, es_nuevo, creado_en, creado_por) "
            "VALUES (?,?,?,?,?,?,?)",
            (
                nombre,
                contacto,
                ciudad,
                segmento,
                1 if es_nuevo else 0,
                datetime.now().isoformat(timespec="seconds"),
                creado_por,
            ),
        )
        return int(cur.lastrowid)


def listar_clientes(db_path: Path | str = DB_PATH, solo_activos: bool = False):
    sql = "SELECT * FROM clientes"
    if solo_activos:
        sql += " WHERE COALESCE(activo, 1) = 1"
    with conectar(db_path) as c:
        return [dict(r) for r in c.execute(sql + " ORDER BY nombre")]


def actualizar_cliente(
    cliente_id: int, *, ciudad: str | None = None, activo: bool | None = None,
    db_path: Path | str = DB_PATH,
) -> None:
    campos, valores = [], []
    if ciudad is not None:
        campos.append("ciudad = ?")
        valores.append(ciudad)
    if activo is not None:
        campos.append("activo = ?")
        valores.append(1 if activo else 0)
    if not campos:
        return
    with conectar(db_path) as c:
        c.execute(f"UPDATE clientes SET {', '.join(campos)} WHERE id = ?", (*valores, cliente_id))


# ---------- Cotizaciones ----------


def _next_codigo(c: sqlite3.Connection) -> str:
    row = c.execute("SELECT COUNT(*) AS n FROM cotizaciones").fetchone()
    n = int(row["n"]) + 1
    return f"COT-{datetime.now().strftime('%Y%m')}-{n:04d}"


def crear_cotizacion(
    vendedor: str,
    cliente_id: int,
    canal: str = "",
    condiciones_pago: str = "Contado",
    vigencia_dias: int = 15,
    tiempo_entrega: str = "",
    notas: str = "",
    flete_adicional: float = 0.0,
    trm: float | None = None,
    cliente_es_nuevo: bool = False,
    db_path: Path | str = DB_PATH,
) -> tuple[int, str]:
    ahora = datetime.now().isoformat(timespec="seconds")
    with conectar(db_path) as c:
        codigo = _next_codigo(c)
        cur = c.execute(
            "INSERT INTO cotizaciones(codigo, fecha, vendedor, cliente_id, canal, "
            "condiciones_pago, vigencia_dias, tiempo_entrega, estado, notas, "
            "flete_adicional, trm, cliente_es_nuevo, actualizado_en) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                codigo,
                ahora,
                vendedor,
                cliente_id,
                canal,
                condiciones_pago,
                vigencia_dias,
                tiempo_entrega,
                ESTADO_BORRADOR,
                notas,
                float(flete_adicional or 0),
                float(trm) if trm else None,
                1 if cliente_es_nuevo else 0,
                ahora,
            ),
        )
        return int(cur.lastrowid), codigo


def agregar_linea(
    cotizacion_id: int,
    orden: int,
    producto: str,
    calibre: str,
    impreso: str,
    empaque: int,
    cantidad_mes: float,
    precio: float,
    costo_unit: float,
    flete_unit: float,
    ub_pct: float | None,
    aprobacion_txt: str,
    db_path: Path | str = DB_PATH,
) -> int:
    with conectar(db_path) as c:
        cur = c.execute(
            "INSERT INTO lineas(cotizacion_id, orden, producto, calibre, impreso, "
            "empaque, cantidad_mes, precio, costo_unit, flete_unit, ub_pct, aprobacion_txt) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                cotizacion_id, orden, producto, calibre, impreso,
                empaque, cantidad_mes, precio, costo_unit, flete_unit, ub_pct, aprobacion_txt,
            ),
        )
        return int(cur.lastrowid)


def reemplazar_lineas(cotizacion_id: int, lineas: Iterable[dict], db_path: Path | str = DB_PATH) -> None:
    """Borra y re-inserta el detalle (uso desde formulario)."""
    ahora = datetime.now().isoformat(timespec="seconds")
    with conectar(db_path) as c:
        c.execute("DELETE FROM lineas WHERE cotizacion_id=?", (cotizacion_id,))
        for i, l in enumerate(lineas, start=1):
            c.execute(
                "INSERT INTO lineas(cotizacion_id, orden, producto, calibre, impreso, "
                "empaque, cantidad_mes, precio, costo_unit, flete_unit, ub_pct, aprobacion_txt) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    cotizacion_id, i,
                    l.get("producto"), l.get("calibre"), l.get("impreso"),
                    l.get("empaque"), l.get("cantidad_mes"), l.get("precio"),
                    l.get("costo_unit"), l.get("flete_unit"), l.get("ub_pct"),
                    l.get("aprobacion_txt"),
                ),
            )
        c.execute(
            "UPDATE cotizaciones SET actualizado_en=? WHERE id=?",
            (ahora, cotizacion_id),
        )


def actualizar_estado_cotizacion(
    cotizacion_id: int, estado: str, usuario: str = "", db_path: Path | str = DB_PATH
) -> None:
    ahora = datetime.now().isoformat(timespec="seconds")
    with conectar(db_path) as c:
        c.execute(
            "UPDATE cotizaciones SET estado=?, actualizado_en=? WHERE id=?",
            (estado, ahora, cotizacion_id),
        )


# Estados desde los cuales se PUEDE pasar automaticamente a 'enviada' al generar
# el PDF. Estados como ganada/perdida/en_negociacion no se pisan (ya estan
# despues de envio).
_ESTADOS_PROMOVIBLES_A_ENVIADA = frozenset({"borrador", "aprobada"})


def promover_a_enviada_si_corresponde(
    cotizacion_id: int, usuario: str, db_path: Path | str = DB_PATH
) -> bool:
    """Si la cotizacion esta en 'borrador' o 'aprobada', la marca como 'enviada'.

    Retorna True si hubo cambio, False si el estado actual no es promovible.
    Se usa cuando el vendedor genera el PDF (= se entiende que ya se envio al cliente).
    """
    from .config import ESTADO_ENVIADA  # import local para evitar ciclo
    ahora = datetime.now().isoformat(timespec="seconds")
    with conectar(db_path) as c:
        row = c.execute("SELECT estado FROM cotizaciones WHERE id=?", (cotizacion_id,)).fetchone()
        if row is None:
            return False
        if row["estado"] not in _ESTADOS_PROMOVIBLES_A_ENVIADA:
            return False
        c.execute(
            "UPDATE cotizaciones SET estado=?, actualizado_en=? WHERE id=?",
            (ESTADO_ENVIADA, ahora, cotizacion_id),
        )
        return True


def marcar_correo_erp(cotizacion_id: int, usuario: str, db_path: Path | str = DB_PATH) -> None:
    """Deja constancia de que se envio al ERP el correo con los precios de la cotizacion."""
    with conectar(db_path) as c:
        c.execute(
            "UPDATE cotizaciones SET erp_correo_en=?, erp_correo_por=? WHERE id=?",
            (datetime.now().isoformat(timespec="seconds"), usuario, cotizacion_id),
        )


def actualizar_cabecera(
    cotizacion_id: int,
    *,
    canal: str | None = None,
    condiciones_pago: str | None = None,
    vigencia_dias: int | None = None,
    tiempo_entrega: str | None = None,
    notas: str | None = None,
    flete_adicional: float | None = None,
    trm: float | None = None,
    cliente_es_nuevo: int | None = None,
    cliente_id: int | None = None,
    db_path: Path | str = DB_PATH,
) -> None:
    campos: list[str] = []
    valores: list[Any] = []
    for nombre, valor in (
        ("canal", canal),
        ("condiciones_pago", condiciones_pago),
        ("vigencia_dias", vigencia_dias),
        ("tiempo_entrega", tiempo_entrega),
        ("notas", notas),
        ("flete_adicional", flete_adicional),
        ("trm", trm),
        ("cliente_es_nuevo", cliente_es_nuevo),
        ("cliente_id", cliente_id),
    ):
        if valor is not None:
            campos.append(f"{nombre}=?")
            valores.append(valor)
    if not campos:
        return
    campos.append("actualizado_en=?")
    valores.append(datetime.now().isoformat(timespec="seconds"))
    valores.append(cotizacion_id)
    with conectar(db_path) as c:
        c.execute(
            f"UPDATE cotizaciones SET {', '.join(campos)} WHERE id=?",
            valores,
        )


def obtener_cotizacion(cotizacion_id: int, db_path: Path | str = DB_PATH) -> dict | None:
    with conectar(db_path) as c:
        row = c.execute(
            "SELECT c.*, cl.nombre AS cliente_nombre, cl.contacto AS cliente_contacto, "
            "cl.ciudad AS cliente_ciudad, cl.segmento AS cliente_segmento "
            "FROM cotizaciones c JOIN clientes cl ON cl.id = c.cliente_id WHERE c.id=?",
            (cotizacion_id,),
        ).fetchone()
        return dict(row) if row else None


def listar_lineas(cotizacion_id: int, db_path: Path | str = DB_PATH) -> list[dict]:
    with conectar(db_path) as c:
        return [
            dict(r)
            for r in c.execute(
                "SELECT * FROM lineas WHERE cotizacion_id=? ORDER BY orden", (cotizacion_id,)
            )
        ]


def listar_cotizaciones_con_totales(
    *,
    vendedor: str | None = None,
    estado: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    db_path: Path | str = DB_PATH,
) -> list[dict]:
    """Igual que `listar_cotizaciones` pero incluye `n_items` y `valor_total`.

    Se calcula en SQL para evitar N+1 desde la UI.
    `valor_total = sum(precio*cantidad_mes) + flete_adicional`.
    """
    where = []
    params: list[Any] = []
    if vendedor:
        where.append("c.vendedor = ?")
        params.append(vendedor)
    if estado:
        where.append("c.estado = ?")
        params.append(estado)
    if desde:
        where.append("c.fecha >= ?")
        params.append(desde)
    if hasta:
        where.append("c.fecha <= ?")
        params.append(hasta)
    sql = (
        "SELECT c.*, cl.nombre AS cliente_nombre, "
        "  COALESCE(agg.n_items, 0) AS n_items, "
        "  COALESCE(agg.subtotal_lineas, 0) + COALESCE(c.flete_adicional, 0) AS valor_total "
        "FROM cotizaciones c "
        "JOIN clientes cl ON cl.id = c.cliente_id "
        "LEFT JOIN ("
        "  SELECT cotizacion_id, COUNT(*) AS n_items, "
        "         SUM(COALESCE(precio,0) * COALESCE(cantidad_mes,0)) AS subtotal_lineas "
        "  FROM lineas GROUP BY cotizacion_id"
        ") agg ON agg.cotizacion_id = c.id"
    )
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY c.fecha DESC"
    with conectar(db_path) as c:
        return [dict(r) for r in c.execute(sql, params)]


def listar_cotizaciones(
    *,
    vendedor: str | None = None,
    estado: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    db_path: Path | str = DB_PATH,
) -> list[dict]:
    where = []
    params: list[Any] = []
    if vendedor:
        where.append("c.vendedor = ?")
        params.append(vendedor)
    if estado:
        where.append("c.estado = ?")
        params.append(estado)
    if desde:
        where.append("c.fecha >= ?")
        params.append(desde)
    if hasta:
        where.append("c.fecha <= ?")
        params.append(hasta)
    sql = (
        "SELECT c.*, cl.nombre AS cliente_nombre FROM cotizaciones c "
        "JOIN clientes cl ON cl.id = c.cliente_id"
    )
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY c.fecha DESC"
    with conectar(db_path) as c:
        return [dict(r) for r in c.execute(sql, params)]


# ---------- Aprobaciones ----------


def registrar_aprobacion(
    cotizacion_id: int,
    decision: str,
    usuario: str,
    motivo: str = "",
    linea_id: int | None = None,
    db_path: Path | str = DB_PATH,
) -> None:
    ahora = datetime.now().isoformat(timespec="seconds")
    with conectar(db_path) as c:
        c.execute(
            "INSERT INTO aprobaciones(cotizacion_id, linea_id, decision, motivo, usuario, creado_en) "
            "VALUES (?,?,?,?,?,?)",
            (cotizacion_id, linea_id, decision, motivo, usuario, ahora),
        )
        if linea_id is not None:
            c.execute(
                "UPDATE lineas SET aprobada=?, aprobada_por=?, aprobada_en=? WHERE id=?",
                (1 if decision == "aprobada" else 0, usuario, ahora, linea_id),
            )
        c.execute(
            "UPDATE cotizaciones SET actualizado_en=? WHERE id=?",
            (ahora, cotizacion_id),
        )


def aprobaciones_de(cotizacion_id: int, db_path: Path | str = DB_PATH) -> list[dict]:
    with conectar(db_path) as c:
        return [
            dict(r)
            for r in c.execute(
                "SELECT * FROM aprobaciones WHERE cotizacion_id=? ORDER BY creado_en DESC",
                (cotizacion_id,),
            )
        ]


# ---------- Seguimientos ----------


def registrar_seguimiento(
    cotizacion_id: int,
    estado: str,
    motivo: str = "",
    categoria_feedback: str = "",
    feedback_cliente: str = "",
    fecha_cierre: str | None = None,
    creado_por: str = "",
    db_path: Path | str = DB_PATH,
) -> int:
    ahora = datetime.now().isoformat(timespec="seconds")
    with conectar(db_path) as c:
        cur = c.execute(
            "INSERT INTO seguimientos(cotizacion_id, estado, motivo, categoria_feedback, "
            "feedback_cliente, fecha_cierre, creado_en, creado_por) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (
                cotizacion_id, estado, motivo, categoria_feedback,
                feedback_cliente, fecha_cierre, ahora, creado_por,
            ),
        )
        c.execute(
            "UPDATE cotizaciones SET estado=?, actualizado_en=? WHERE id=?",
            (estado, ahora, cotizacion_id),
        )
        return int(cur.lastrowid)


def listar_seguimientos(cotizacion_id: int, db_path: Path | str = DB_PATH) -> list[dict]:
    with conectar(db_path) as c:
        return [
            dict(r)
            for r in c.execute(
                "SELECT * FROM seguimientos WHERE cotizacion_id=? ORDER BY creado_en DESC",
                (cotizacion_id,),
            )
        ]


def exportar_lineas_para_vendedor(cotizacion_id: int, db_path: Path | str = DB_PATH) -> list[dict]:
    """Devuelve lineas SIN columnas de costo (uso seguro en vista vendedor / cliente)."""
    rows = listar_lineas(cotizacion_id, db_path)
    out = []
    for r in rows:
        rv = {k: v for k, v in r.items() if k not in ("costo_unit",)}
        out.append(rv)
    return out
