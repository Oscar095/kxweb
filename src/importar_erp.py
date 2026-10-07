"""Importa del Excel de ventas del ERP (detalle de remisiones) los clientes, los vendedores
y la referencia de precios de venta. NO toca costos ni la lista de productos: esos salen
solo del inventario (ver src/costos_inventario.py).

Uso, desde la carpeta del cotizador:
    python -m src.importar_erp "ruta\\costos precios enero sep 26.xlsx"

Hace tres cosas:
1. Clientes: la lista pasa a ser las razones sociales del archivo; los demas
   quedan inactivos (no se borran: conservan su historial).
2. Vendedores: crea los vendedores del archivo que son personas, con clave
   temporal; los vendedores que ya no estan quedan inactivos.
3. Referencia de precios: lo que realmente pagaron los clientes por cada producto
   (hoja PreciosClientes y columnas PRECIO_* del catalogo). Solo cuentan ventas de
   producto; se excluyen devoluciones, servicios, fletes, desechos y planchas.
"""
from __future__ import annotations

import argparse
import unicodedata
from datetime import datetime
from pathlib import Path

import pandas as pd

from . import database, usuarios
from .config import CATALOGO_XLSX, DATA_DIR, DB_PATH, ROL_VENDEDOR

SIN_CALIBRE = "NO APLICA"
MESES_RECIENTES = 3
PRECIO_MINIMO_REFERENCIA = 0.4  # precios menores al 40% de la mediana no cuentan como referencia
_NO_PRODUCTO = ("DESECHO", "SERVICIO", "FLETES", "REINTEGRO", "PELICULAS Y PLANCHAS")
# Nombres de vendedor que son cuentas o canales, no personas.
_PALABRAS_CUENTA = {"KOS", "VENTAS", "DISTRIBUIDORES", "EXPORTACIONES", "SAS"}
_COLUMNAS = {
    "fecha": "fecha",
    "item": "desc. item",
    "calibre": "calibre",
    "cantidad": "cantidad inv.",
    "valor": "valor subtotal local",
    "vendedor": "nombre vendedor",
    "cliente": "razon social cliente",
    "pais": "desc. pais",
    "ciudad": "desc. ciudad",
}
# Columnas de Items que vienen de la referencia de precios (se reemplazan en cada importacion)
_PREFIJOS_PRECIOS = ("PRECIO_", "CLIENTE_", "CANTIDAD_", "FECHA_")
_COLUMNAS_PRECIOS = ("VENTAS", "CLIENTES")


def _norm(texto) -> str:
    """Mayusculas, sin tildes y con espacios simples (para comparar nombres)."""
    t = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return " ".join(t.upper().split())


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------


def leer_movimientos(ruta: Path | str) -> pd.DataFrame:
    crudo = pd.read_excel(ruta)
    por_nombre = {_norm(c).lower(): c for c in crudo.columns}
    columnas = {}
    for destino, buscado in _COLUMNAS.items():
        origen = next((orig for n, orig in por_nombre.items() if n.startswith(buscado)), None)
        if origen is None:
            raise ValueError(f"Falta la columna '{buscado}' en {ruta}")
        columnas[origen] = destino
    mov = crudo[list(columnas)].rename(columns=columnas)
    mov["fecha"] = pd.to_datetime(mov["fecha"], errors="coerce")
    mov = mov[mov["fecha"].notna()].copy()  # quita la fila "Gran total"
    for col in ("item", "calibre", "vendedor", "cliente", "pais", "ciudad"):
        mov[col] = mov[col].fillna("").astype(str).map(lambda v: " ".join(v.split()))
    for col in ("cantidad", "valor"):
        mov[col] = pd.to_numeric(mov[col], errors="coerce").fillna(0.0)
    return mov


def es_producto(item: str) -> bool:
    return bool(item) and not _norm(item).startswith(_NO_PRODUCTO)


# ---------------------------------------------------------------------------
# Referencia de precios (lo que realmente pagaron los clientes)
# ---------------------------------------------------------------------------


def precios_referencia(mov: pd.DataFrame, meses: int = MESES_RECIENTES) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Precios reales de venta (valor facturado / unidades) por producto y por cliente.

    Devuelve (por_producto, por_cliente). El volumen mensual del cliente es el total
    de unidades del periodo dividido por los meses del archivo: sirve para comparar
    contra clientes de tamano parecido, porque los precios mas altos suelen ser
    pedidos pequenos.
    """
    ventas = mov[(mov["cantidad"] > 0) & (mov["valor"] > 0) & mov["item"].map(es_producto)].copy()
    ventas["calibre"] = ventas["calibre"].where(ventas["calibre"] != "", SIN_CALIBRE)
    ventas["precio"] = ventas["valor"] / ventas["cantidad"]
    claves = ["item", "calibre"]
    # Precios por debajo del 40% de la mediana del producto son muestras, notas o errores
    # de digitacion (p. ej. 11,87 en una tapa de 67): no sirven de referencia.
    mediana = ventas.groupby(claves)["precio"].transform("median")
    ventas = ventas[ventas["precio"] >= mediana * PRECIO_MINIMO_REFERENCIA]
    fin = ventas["fecha"].max()
    inicio_reciente = (fin.to_period("M") - (meses - 1)).to_timestamp()
    n_meses = max(1, ventas["fecha"].dt.to_period("M").nunique())
    periodo = f"{ventas['fecha'].min():%Y-%m-%d} a {fin:%Y-%m-%d}"

    g = ventas.groupby(claves)
    por_producto = pd.DataFrame({
        "PRECIO_MEDIANA": g["precio"].median().round(2),
        "PRECIO_PROMEDIO": (g["valor"].sum() / g["cantidad"].sum()).round(2),
        "PRECIO_P25": g["precio"].quantile(0.25).round(2),
        "PRECIO_P75": g["precio"].quantile(0.75).round(2),
        "VENTAS": g.size(),
        "CLIENTES": g["cliente"].nunique(),
    })
    rec = ventas[ventas["fecha"] >= inicio_reciente].groupby(claves).agg(v=("valor", "sum"), u=("cantidad", "sum"))
    por_producto[f"PRECIO_PROM_{meses}M"] = (rec["v"] / rec["u"]).round(2)
    # Venta con el precio mas alto y con el mas bajo (si empatan, la de mas unidades)
    for sufijo, ascendente in (("MAX", False), ("MIN", True)):
        extremo = (ventas.sort_values(["precio", "cantidad"], ascending=[ascendente, False])
                   .groupby(claves).head(1).set_index(claves))
        por_producto[f"PRECIO_{sufijo}"] = extremo["precio"].round(2)
        por_producto[f"CLIENTE_{sufijo}"] = extremo["cliente"]
        por_producto[f"CANTIDAD_{sufijo}"] = extremo["cantidad"]
        por_producto[f"FECHA_{sufijo}"] = extremo["fecha"].dt.strftime("%Y-%m-%d")
    por_producto = por_producto.reset_index().rename(columns={"item": "DESCRIPCION", "calibre": "CALIBRE"})

    llave = claves + ["cliente"]
    mejor = ventas.loc[ventas.groupby(llave)["precio"].idxmax(), llave + ["precio", "cantidad", "fecha", "vendedor"]]
    ultima = ventas.sort_values("fecha").groupby(llave).tail(1)[llave + ["precio", "fecha"]]
    total = ventas.groupby(llave).agg(UNIDADES_PERIODO=("cantidad", "sum"), VALOR_PERIODO=("valor", "sum")).reset_index()
    por_cliente = (
        mejor.rename(columns={"precio": "MEJOR_PRECIO", "cantidad": "CANTIDAD_MEJOR",
                              "fecha": "FECHA_MEJOR", "vendedor": "VENDEDOR_MEJOR"})
        .merge(ultima.rename(columns={"precio": "ULTIMO_PRECIO", "fecha": "FECHA_ULTIMO"}), on=llave)
        .merge(total, on=llave)
    )
    por_cliente["PRECIO_PROMEDIO"] = (por_cliente["VALOR_PERIODO"] / por_cliente["UNIDADES_PERIODO"]).round(2)
    por_cliente["VOLUMEN_MENSUAL"] = (por_cliente["UNIDADES_PERIODO"] / n_meses).round(0)
    for col in ("MEJOR_PRECIO", "ULTIMO_PRECIO"):
        por_cliente[col] = por_cliente[col].round(2)
    for col in ("FECHA_MEJOR", "FECHA_ULTIMO"):
        por_cliente[col] = por_cliente[col].dt.strftime("%Y-%m-%d")
    por_cliente["PERIODO"] = periodo
    por_cliente = por_cliente.rename(columns={"item": "DESCRIPCION", "calibre": "CALIBRE", "cliente": "CLIENTE"})
    columnas = ["DESCRIPCION", "CALIBRE", "CLIENTE", "MEJOR_PRECIO", "CANTIDAD_MEJOR", "FECHA_MEJOR",
                "VENDEDOR_MEJOR", "ULTIMO_PRECIO", "FECHA_ULTIMO", "PRECIO_PROMEDIO", "UNIDADES_PERIODO",
                "VOLUMEN_MENSUAL", "PERIODO"]
    return por_producto, por_cliente[columnas].sort_values(["DESCRIPCION", "CALIBRE", "CLIENTE"])


# ---------------------------------------------------------------------------
# Clientes y vendedores
# ---------------------------------------------------------------------------


def clientes_erp(mov: pd.DataFrame) -> pd.DataFrame:
    """Razones sociales con compras de producto, con su ciudad y pais mas frecuentes."""
    ventas = mov[(mov["cantidad"] > 0) & mov["item"].map(es_producto) & (mov["cliente"] != "")]

    def moda(s: pd.Series) -> str:
        s = s[s != ""]
        return s.mode().iloc[0] if not s.empty else ""

    g = ventas.groupby("cliente").agg(ciudad=("ciudad", moda), pais=("pais", moda)).reset_index()
    return g.rename(columns={"cliente": "nombre"}).sort_values("nombre").reset_index(drop=True)


def es_persona(nombre: str) -> bool:
    return not (set(_norm(nombre).split()) & _PALABRAS_CUENTA)


def vendedores_erp(mov: pd.DataFrame) -> tuple[list[str], list[str]]:
    nombres = sorted({v for v in mov["vendedor"] if v})
    return [n for n in nombres if es_persona(n)], [n for n in nombres if not es_persona(n)]


def _ciudad_texto(ciudad: str, pais: str) -> str:
    if pais and _norm(pais) != "COLOMBIA":
        return f"{ciudad}, {pais}" if ciudad else pais
    return ciudad


def _clave_cliente(nombre: str) -> str:
    """'Postobon S.A.' y 'POSTOBON S A' son el mismo cliente."""
    return " ".join("".join(ch if ch.isalnum() else " " for ch in _norm(nombre)).split())


def sincronizar_clientes(clientes: pd.DataFrame, *, db_path: Path | str = DB_PATH) -> dict:
    existentes = database.listar_clientes(db_path)
    por_clave: dict[str, list[dict]] = {}
    for c in existentes:  # puede haber nombres repetidos
        por_clave.setdefault(_clave_cliente(c["nombre"]), []).append(c)
    en_erp = set()
    nuevos = actualizados = 0
    for r in clientes.itertuples(index=False):
        clave = _clave_cliente(r.nombre)
        en_erp.add(clave)
        ciudad = _ciudad_texto(r.ciudad, r.pais)
        if clave in por_clave:
            for c in por_clave[clave]:
                database.actualizar_cliente(c["id"], ciudad=ciudad, activo=True, db_path=db_path)
            actualizados += 1
        else:
            database.crear_cliente(r.nombre, "", ciudad, "", es_nuevo=False, creado_por="ERP", db_path=db_path)
            nuevos += 1
    inactivos = 0
    for c in existentes:
        activo = 1 if c.get("activo") is None else int(c["activo"])
        if _clave_cliente(c["nombre"]) not in en_erp and activo == 1:
            database.actualizar_cliente(c["id"], activo=False, db_path=db_path)
            inactivos += 1
    return {"nuevos": nuevos, "actualizados": actualizados, "inactivados": inactivos}


def _mismo_vendedor(nombre_app: str, nombre_erp: str) -> bool:
    """'Elena Acosta' coincide con 'ACOSTA SALDAÑA LUZ ELENA' (todas sus palabras estan)."""
    app, erp = set(_norm(nombre_app).split()), set(_norm(nombre_erp).split())
    return len(app) >= 2 and app <= erp


def sincronizar_vendedores(personas: list[str], *, db_path: Path | str = DB_PATH) -> dict:
    """Vincula cada vendedor del ERP con su usuario, o lo crea con nombre y primer apellido.

    - El usuario conserva su nombre en la app; el nombre del ERP se guarda aparte.
    - No se vuelven a crear los vendedores del ERP que el gerente elimino.
    - Solo se desactivan usuarios vinculados al ERP que ya no aparecen en el archivo;
      los creados a mano en la app no se tocan.
    """
    resultado = {"vinculados": [], "creados": {}, "desactivados": [], "reactivados": [], "excluidos": []}
    excluidos = {_norm(n) for n in usuarios.excluidos_erp(db_path=db_path)}
    vendedores = [u for u in usuarios.listar_usuarios(db_path=db_path) if u["rol"] == ROL_VENDEDOR]
    vigentes = set()

    for erp in personas:
        clave = _norm(erp)
        if clave in excluidos:
            resultado["excluidos"].append(erp)
            continue
        vigentes.add(clave)
        usuario = next((u for u in vendedores if _norm(u.get("nombre_erp")) == clave), None)
        if usuario is None:
            usuario = next((u for u in vendedores if not u.get("nombre_erp")
                            and _mismo_vendedor(u["nombre"], erp)), None)
            if usuario is not None:
                usuarios.asignar_nombre_erp(usuario["nombre"], erp, db_path=db_path)
                usuario["nombre_erp"] = erp
                resultado["vinculados"].append((usuario["nombre"], erp))
        if usuario is None:
            nombre = usuarios.nombre_corto(erp)
            if any(_norm(u["nombre"]) == _norm(nombre) for u in vendedores):
                nombre = erp.title()  # ya existe alguien con ese nombre corto
            resultado["creados"][nombre] = usuarios.crear_vendedor(nombre, nombre_erp=erp, db_path=db_path)
            vendedores.append({"nombre": nombre, "nombre_erp": erp, "activo": 1, "rol": ROL_VENDEDOR})
            continue
        if not usuario.get("activo", 1):
            usuarios.establecer_activo(usuario["nombre"], True, db_path=db_path)
            resultado["reactivados"].append(usuario["nombre"])

    for u in vendedores:
        if u.get("nombre_erp") and _norm(u["nombre_erp"]) not in vigentes and u.get("activo", 1):
            usuarios.establecer_activo(u["nombre"], False, db_path=db_path)
            resultado["desactivados"].append(u["nombre"])
    return resultado




# ---------------------------------------------------------------------------
# Catalogo: solo clientes y referencia de precios
# ---------------------------------------------------------------------------


def actualizar_catalogo(clientes: pd.DataFrame, precios: tuple[pd.DataFrame, pd.DataFrame],
                        destino: Path = CATALOGO_XLSX) -> Path:
    """Reemplaza en el catalogo las hojas Clientes y PreciosClientes y las columnas de
    referencia de precios de Items. Costos, productos y ajustes no se tocan."""
    destino = Path(destino)
    if not destino.exists():
        raise FileNotFoundError(
            f"No existe {destino}. Primero carga el inventario: python -m src.costos_inventario \"archivo.xls\"")
    hojas = pd.read_excel(destino, sheet_name=None)
    por_producto, por_cliente = precios
    items = hojas["Items"]
    items = items[[c for c in items.columns
                   if not (str(c).startswith(_PREFIJOS_PRECIOS) or c in _COLUMNAS_PRECIOS)]]
    hojas["Items"] = items.merge(por_producto, on=["DESCRIPCION", "CALIBRE"], how="left")
    hojas["PreciosClientes"] = por_cliente
    hojas["Clientes"] = clientes
    with pd.ExcelWriter(destino, engine="openpyxl") as xw:
        for nombre, df in hojas.items():
            df.to_excel(xw, sheet_name=nombre, index=False)
        for hoja in xw.book.worksheets:
            for columna in hoja.columns:
                largo = max(len(str(c.value or "")) for c in columna)
                hoja.column_dimensions[columna[0].column_letter].width = min(max(12, largo + 2), 70)
    return destino


def importar(ruta: Path | str, *, db_path: Path | str = DB_PATH, destino: Path = CATALOGO_XLSX) -> dict:
    ruta = Path(ruta)
    mov = leer_movimientos(ruta)
    clientes = clientes_erp(mov)
    personas, cuentas = vendedores_erp(mov)
    database.inicializar(db_path)
    actualizar_catalogo(clientes, precios_referencia(mov), destino)
    res_clientes = sincronizar_clientes(clientes, db_path=db_path)
    res_vendedores = sincronizar_vendedores(personas, db_path=db_path)

    if res_vendedores["creados"]:
        archivo = DATA_DIR / f"claves_vendedores_{datetime.now():%Y-%m-%d}.txt"
        with open(archivo, "a", encoding="utf-8") as f:
            f.write(f"Claves temporales (creadas {datetime.now():%Y-%m-%d %H:%M}). "
                    "Cada vendedor debe cambiarla al entrar. Borra este archivo despues de entregarlas.\n\n")
            for nombre, clave in res_vendedores["creados"].items():
                f.write(f"{nombre}: {clave}\n")
            f.write("\n")
        res_vendedores["archivo_claves"] = archivo
    return {"clientes": res_clientes, "vendedores": res_vendedores, "cuentas_no_creadas": cuentas}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Importa clientes, vendedores y referencia de precios desde el Excel de ventas del ERP.")
    parser.add_argument("archivo", help="Excel del ERP con el detalle de remisiones")
    args = parser.parse_args(argv)
    r = importar(args.archivo)
    print("Clientes:", r["clientes"])
    v = r["vendedores"]
    print("Vendedores vinculados:", v["vinculados"], "| creados:", list(v["creados"]),
          "| desactivados:", v["desactivados"], "| excluidos por el gerente:", v["excluidos"])
    if v.get("archivo_claves"):
        print("Claves temporales en:", v["archivo_claves"])
    print("Cuentas del ERP que no se crearon como usuario:", r["cuentas_no_creadas"])
    print("Referencia de precios actualizada en el catálogo (los costos no se tocan).")


if __name__ == "__main__":
    main()
