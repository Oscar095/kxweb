"""Pantallas de cotizacion. El vendedor NUNCA ve costos.

    - Nueva cotizacion: tres pasos (cliente, productos, resumen y envio). Tambien
      sirve para editar borradores y cotizaciones rechazadas.
    - Mis cotizaciones: arriba lo que requiere accion (aprobadas con PDF en un
      clic, rechazadas para ajustar); abajo el listado. «Ver» abre la ficha de la
      cotizacion: productos, totales, la oferta en PDF e historial.
"""
from __future__ import annotations

import hashlib
import json
import re

import pandas as pd
import streamlit as st

from .. import database, plantilla_word, referencias, ui, usuarios
from ..config import (
    CANALES,
    ESTADO_APROBADA,
    ESTADO_BORRADOR,
    ESTADO_LABEL,
    ESTADO_PENDIENTE_APROBACION,
    ESTADO_RECHAZADA,
    ROL_GERENTE,
    SALIDAS_DIR,
    canal_vigente,
    es_exportacion,
    estado_label,
)
from ..excel_loader import (
    calcular_costo_item,
    calibres_de_producto,
    cargar_catalogo,
    flete_unitario,
)
from ..formato import fmt_miles, fmt_moneda, fmt_porcentaje, fmt_usd
from ..pdf_generator import generar_pdf_oferta
from .erp import pendientes_correo_erp, puede_ver_correo_erp, tarjeta_correo_erp, texto_estado_correo
from ..pricing import (
    APROB_COMERCIAL,
    APROB_COMERCIAL_FIN,
    calcular_ub_pct,
    estado_aprobacion,
    puede_generar_pdf,
)

ESTADOS_EDITABLES = (ESTADO_BORRADOR, ESTADO_RECHAZADA)
# En pantalla la aprobacion se muestra corta; la BD guarda el texto completo.
COL_APROBACION = "Requiere aprobación"
_APROBACION_CORTA = {
    APROB_COMERCIAL_FIN: "Comercial y financiera",
    APROB_COMERCIAL: "Comercial",
}
# Anchos compactos para que la tabla de productos quepa sin scroll horizontal.
COLUMNAS_LINEAS = {
    "Calibre": st.column_config.TextColumn(width="small"),
    "Impreso": st.column_config.TextColumn(width="small"),
    "Empaque": st.column_config.TextColumn(width="small"),
    "Cantidad mes": st.column_config.TextColumn("Cant. mes", width="small"),
    "Precio": st.column_config.TextColumn(width="small"),
    "UB%": st.column_config.TextColumn(width="small"),
    "Vs. mercado": st.column_config.TextColumn(
        help="Tu precio frente a lo que pagan clientes de volumen mensual parecido (ventas reales del ERP)."),
}
COL_MERCADO = "Vs. mercado"

_DEFAULTS_NV = {
    "nv_lineas": [],
    "nv_canal": "Horeca",
    "nv_pago": "30 dias",
    "nv_vig": 15,
    "nv_entrega": "30 días calendario",
    "nv_notas": "",
    "nv_flete_adicional": 0.0,
    "nv_trm": 0.0,
    "nv_tipo_cliente": None,  # 'nuevo' | 'existente' — obligatorio
    "nv_editar_id": None,
}
# Estado interno de los widgets del formulario. Se borra al reiniciar o al
# cargar otra cotizacion; si no, Streamlit mostraria los valores anteriores.
_WIDGETS_NV = (
    "nv_tipo_radio", "nv_canal_sel", "nv_trm_in", "nv_pago_in", "nv_vig_in",
    "nv_entrega_in", "nv_notas_in", "nv_flete_in", "nv_cli_exist", "nv_prod_sel",
    "nv_cliente_recien_creado", "nv_cliente_id_preload",
)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def _cargar_catalogo_cache():
    if "catalogo" not in st.session_state:
        try:
            st.session_state["catalogo"] = cargar_catalogo()
        except FileNotFoundError as e:
            st.error(str(e))
            st.stop()
    return st.session_state["catalogo"]


def _fmt_precio(valor: float) -> str:
    valor = float(valor or 0)
    return fmt_moneda(valor, 0 if valor.is_integer() else 2)


_CAMPOS_PDF = (
    "codigo", "fecha", "vendedor", "cliente_nombre", "cliente_contacto", "cliente_ciudad",
    "canal", "condiciones_pago", "vigencia_dias", "tiempo_entrega", "notas", "flete_adicional", "trm",
)
_CAMPOS_LINEA_PDF = ("producto", "calibre", "impreso", "empaque", "cantidad_mes", "precio")


def pdf_de_cotizacion(cot_id: int) -> tuple[bytes, str]:
    """PDF de oferta (sin costos): (contenido, nombre de archivo para descargar).

    Generar con Word toma unos segundos, asi que el PDF se guarda y se reutiliza
    mientras no cambien los datos que se imprimen (cotizacion, lineas, firma o plantilla).
    """
    cot = database.obtener_cotizacion(cot_id)
    lineas = database.exportar_lineas_para_vendedor(cot_id)
    vendedor = usuarios.perfil(cot["vendedor"])
    plantilla = plantilla_word.PLANTILLA_DOCX
    huella = json.dumps(
        [
            {k: cot.get(k) for k in _CAMPOS_PDF},
            [{k: l.get(k) for k in _CAMPOS_LINEA_PDF} for l in lineas],
            {k: vendedor.get(k) for k in ("nombre", "cargo", "celular")},
            plantilla.stat().st_mtime if plantilla.exists() else 0,
        ],
        sort_keys=True, default=str,
    )
    firma = hashlib.sha1(huella.encode("utf-8")).hexdigest()[:10]
    ruta = SALIDAS_DIR / f"oferta_{cot['codigo']}_{firma}.pdf"
    if not ruta.exists():
        for patron in (f"oferta_{cot['codigo']}.pdf", f"oferta_{cot['codigo']}_*.pdf"):
            for vieja in SALIDAS_DIR.glob(patron):
                vieja.unlink(missing_ok=True)
        generar_pdf_oferta(cot, lineas, salida=ruta, vendedor=vendedor)
    cliente = re.sub(r'[\\/:*?"<>|]+', " ", cot.get("cliente_nombre") or "").strip()
    return ruta.read_bytes(), f"Cotizacion {cot['codigo']} {cliente}.pdf".replace("  ", " ")


def contar_aprobadas(usuario) -> int:
    """Cotizaciones del vendedor aprobadas y aun sin enviar (PDF pendiente)."""
    return len(database.listar_cotizaciones(vendedor=usuario.nombre, estado=ESTADO_APROBADA))


def _boton_descargar_pdf(usuario, cot: dict, key: str, etiqueta: str = "Descargar PDF") -> None:
    """Un clic: descarga el PDF y, si estaba en borrador o aprobada, la marca como enviada."""
    with st.spinner("Preparando PDF…"):
        data, nombre = pdf_de_cotizacion(int(cot["id"]))
    if st.download_button(
        f"{etiqueta}", data, file_name=nombre, mime="application/pdf",
        type="primary", use_container_width=True, key=key,
    ):
        if database.promover_a_enviada_si_corresponde(int(cot["id"]), usuario.nombre):
            st.session_state["mc_flash"] = (
                "ok", f"{cot['codigo']} marcada como enviada",
                "Cuando el cliente responda, regístralo en Seguimiento.",
            )
        # La oferta salio al cliente: queda listo el correo para registrar los precios en el ERP.
        actual = database.obtener_cotizacion(int(cot["id"]))
        if actual and not actual.get("erp_correo_en") and puede_ver_correo_erp(
                usuario, actual, database.listar_lineas(int(cot["id"]))):
            st.session_state["mc_correo_erp"] = int(cot["id"])
        st.rerun()


# ---------------------------------------------------------------------------
# Cliente
# ---------------------------------------------------------------------------


def _form_cliente_existente(key_prefix: str, cliente_actual_id: int | None = None) -> int | None:
    clientes = database.listar_clientes(solo_activos=True)
    if cliente_actual_id and all(c["id"] != cliente_actual_id for c in clientes):
        # Cotizacion de un cliente que ya no esta en la lista vigente: se conserva.
        clientes += [c for c in database.listar_clientes() if c["id"] == cliente_actual_id]
    if not clientes:
        ui.aviso("info", "Aún no hay clientes registrados", "Elige «Nuevo» para crear el primero.")
        return None
    ids = [c["id"] for c in clientes]
    nombres = {c["id"]: c["nombre"] for c in clientes}
    indice = ids.index(cliente_actual_id) if cliente_actual_id in ids else None
    return st.selectbox(
        "Cliente *", ids, index=indice, format_func=lambda i: nombres.get(i, str(i)),
        placeholder="Busca o elige un cliente", key=f"{key_prefix}_cli_exist",
    )


def _form_cliente_nuevo(usuario, key_prefix: str) -> int | None:
    """Crea el cliente y lo deja asignado: no hay que buscarlo despues."""
    key_creado = f"{key_prefix}_cliente_recien_creado"
    cid = st.session_state.get(key_creado)
    if cid:
        info = next((c for c in database.listar_clientes() if c["id"] == cid), None)
        if info is None:
            st.session_state.pop(key_creado, None)
            return None
        detalle = " · ".join(x for x in (info.get("contacto"), info.get("ciudad"), info.get("segmento")) if x)
        c1, c2 = st.columns([4, 1], vertical_alignment="center")
        with c1:
            ui.aviso("ok", f"Cliente nuevo: {info['nombre']}", detalle)
        if c2.button("Cambiar", key=f"{key_prefix}_cambiar_nuevo", use_container_width=True):
            st.session_state.pop(key_creado, None)
            st.rerun()
        return int(cid)

    with st.form(f"{key_prefix}_form_cli_nuevo", border=False):
        a, b = st.columns(2)
        nombre = a.text_input("Nombre del cliente *")
        contacto = b.text_input("Contacto *", placeholder="Nombre, teléfono o correo")
        ciudad = a.text_input("Ciudad")
        segmento = b.text_input("Segmento", placeholder="Distri, Horeca, Expo, KA, Medianos, KX…")
        crear = st.form_submit_button("Crear cliente", type="primary")
    if crear:
        if not nombre.strip():
            st.error("Escribe el nombre del cliente.")
        elif not contacto.strip():
            st.error("Escribe el contacto del cliente.")
        else:
            st.session_state[key_creado] = database.crear_cliente(
                nombre, contacto, ciudad, segmento, es_nuevo=True, creado_por=usuario.nombre,
            )
            st.rerun()
    return None


# ---------------------------------------------------------------------------
# Calculo de lineas
# ---------------------------------------------------------------------------


def _enriquecer_linea(linea: dict, items: pd.DataFrame, materiales: pd.DataFrame,
                      costos_grupo: pd.DataFrame, flete_val: float, politica) -> dict:
    """Calcula costo, UB%, aprobacion y montos a partir de los campos basicos."""
    match = items[
        (items["DESCRIPCION"].astype(str) == str(linea["producto"]))
        & (items["CALIBRE"].astype(str) == str(linea["calibre"]))
    ] if not items.empty else pd.DataFrame()
    costo_unit = 0.0
    if not match.empty:
        c = calcular_costo_item(match.iloc[0], materiales, costos_grupo)
        if c is not None:
            costo_unit = float(c)
    precio = float(linea.get("precio") or 0)
    cantidad = float(linea.get("cantidad_mes") or 0)
    ub = calcular_ub_pct(precio, costo_unit, flete_val)
    enriched = dict(linea)
    enriched.update({
        "costo_unit": costo_unit,
        "flete_unit": float(flete_val),
        "ub_pct": ub,
        "aprobacion": estado_aprobacion(ub, politica),
        "venta_total": precio * cantidad,
        "margen_dinero": (precio - costo_unit - flete_val) * cantidad,
    })
    return enriched


def _texto_mercado(catalogo, linea: dict) -> str:
    """'-8% · ref $ 103': precio de la linea frente a clientes de volumen parecido."""
    if catalogo is None:
        return ""
    ref = referencias.referencia_volumen(catalogo, linea["producto"], linea["calibre"], linea.get("cantidad_mes"))
    dif = referencias.diferencia(float(linea.get("precio") or 0), ref)
    if dif is None:
        return "—"
    signo = "+" if dif > 0.0005 else ("-" if dif < -0.0005 else "")
    return f"{signo}{abs(dif) * 100:.0f}% · ref {fmt_moneda(ref['precio'], 0)}"


def _vista_lineas(lineas: list[dict], es_gerente: bool, catalogo=None) -> pd.DataFrame:
    """Tabla para pantalla. Las columnas de costo solo se agregan para el gerente."""
    filas = []
    for l in lineas:
        fila = {
            "Producto": l["producto"],
            "Calibre": l["calibre"],
            "Impreso": "Sí" if str(l.get("impreso")).lower() == "si" else "No",
            "Empaque": fmt_miles(l.get("empaque")),
            "Cantidad mes": fmt_miles(l.get("cantidad_mes")),
            "Precio": _fmt_precio(l.get("precio")),
            "Subtotal": fmt_moneda(float(l.get("precio") or 0) * float(l.get("cantidad_mes") or 0), 0),
        }
        if es_gerente:
            fila["Costo total u."] = fmt_moneda(float(l.get("costo_unit") or 0) + float(l.get("flete_unit") or 0), 2)
            fila["Margen $"] = fmt_moneda(
                (float(l.get("precio") or 0) - float(l.get("costo_unit") or 0) - float(l.get("flete_unit") or 0))
                * float(l.get("cantidad_mes") or 0), 0,
            )
        fila["UB%"] = fmt_porcentaje(l.get("ub_pct"), 1)
        if catalogo is not None:
            fila[COL_MERCADO] = _texto_mercado(catalogo, l)
        texto = (l.get("aprobacion") or l.get("aprobacion_txt") or "").strip()
        fila[COL_APROBACION] = _APROBACION_CORTA.get(texto, texto or "No")
        filas.append(fila)
    return pd.DataFrame(filas)


# ---------------------------------------------------------------------------
# Estado del formulario
# ---------------------------------------------------------------------------


def _init_estado_nueva(force_reset: bool = False) -> None:
    if force_reset:
        for k in list(_DEFAULTS_NV) + list(_WIDGETS_NV):
            st.session_state.pop(k, None)
        for k in [k for k in st.session_state if str(k).startswith(("nv_cal_sel_", "nv_emp_"))]:
            st.session_state.pop(k, None)
        # Tabla nueva = seleccion de filas limpia.
        st.session_state["nv_tabla_ver"] = st.session_state.get("nv_tabla_ver", 0) + 1
    st.session_state.setdefault("nv_tabla_ver", 0)
    for k, v in _DEFAULTS_NV.items():
        if k not in st.session_state:
            st.session_state[k] = list(v) if isinstance(v, list) else v


def _cargar_a_sesion(cot_id: int) -> None:
    """Carga una cotizacion guardada en el formulario para editarla."""
    cot = database.obtener_cotizacion(cot_id)
    if not cot:
        return
    _init_estado_nueva(force_reset=True)
    st.session_state["nv_lineas"] = [
        {
            "producto": l["producto"],
            "calibre": l["calibre"],
            "impreso": l["impreso"],
            "empaque": int(l["empaque"] or 0),
            "cantidad_mes": float(l["cantidad_mes"] or 0),
            "precio": float(l["precio"] or 0),
        }
        for l in database.listar_lineas(cot_id)
    ]
    st.session_state["nv_canal"] = canal_vigente(cot.get("canal"))  # 'Exportaciones' -> 'Expo'
    st.session_state["nv_pago"] = cot.get("condiciones_pago") or ""
    st.session_state["nv_vig"] = int(cot.get("vigencia_dias") or 15)
    st.session_state["nv_entrega"] = cot.get("tiempo_entrega") or ""
    st.session_state["nv_notas"] = cot.get("notas") or ""
    st.session_state["nv_flete_adicional"] = float(cot.get("flete_adicional") or 0)
    st.session_state["nv_trm"] = float(cot.get("trm") or 0)
    es_nuevo = int(cot.get("cliente_es_nuevo") or 0) == 1
    st.session_state["nv_tipo_cliente"] = "nuevo" if es_nuevo else "existente"
    if es_nuevo:
        st.session_state["nv_cliente_recien_creado"] = cot["cliente_id"]
    else:
        st.session_state["nv_cliente_id_preload"] = cot["cliente_id"]
    st.session_state["nv_editar_id"] = cot_id


def _terminar(resultado: dict | None) -> None:
    """Limpia el formulario y, si hay resultado, lo muestra en una pantalla propia.

    El resultado se muestra en lugar del formulario (no arriba de el) para que el
    vendedor lo vea aunque haya pulsado el boton al final de la pagina.
    """
    _init_estado_nueva(force_reset=True)
    if resultado:
        st.session_state["nv_resultado"] = resultado
    st.rerun()


def _pantalla_resultado(usuario, res: dict) -> None:
    titulos = {
        "pdf": ("Cotización lista", "Descarga el PDF y compártelo con el cliente."),
        "aprobacion": ("Enviada a aprobación", "Te avisaremos en Mis cotizaciones cuando el gerente la apruebe; "
                                              "desde ahí descargas el PDF con un clic."),
        "borrador": ("Borrador guardado", "Lo encuentras en Mis cotizaciones para terminarlo después."),
    }
    titulo, texto = titulos[res["tipo"]]
    ui.encabezado(titulo, f"{res['codigo']} · {res['cliente']} · Total {res['total']}")
    col, _ = st.columns([1.4, 1])
    with col:
        with ui.tarjeta():
            ui.aviso("ok" if res["tipo"] != "aprobacion" else "info", titulo, texto)
            if res["tipo"] == "pdf":
                st.download_button(
                    "Descargar PDF", data=res["data"], file_name=res["file_name"],
                    mime="application/pdf", type="primary", use_container_width=True,
                    key="nv_res_descargar",
                )
                st.caption("La cotización quedó marcada como enviada. Registra la respuesta del cliente en Seguimiento.")
            a, b = st.columns(2)
            if a.button("Crear otra cotización", use_container_width=True, key="nv_res_otra",
                        type="secondary" if res["tipo"] == "pdf" else "primary"):
                st.session_state.pop("nv_resultado", None)
                st.rerun()
            if b.button("Ir a Mis cotizaciones", use_container_width=True, key="nv_res_mis"):
                st.session_state.pop("nv_resultado", None)
                st.session_state["pagina"] = "mis" if usuario.rol != ROL_GERENTE else "cotizaciones"
                st.rerun()

    # La oferta salio al cliente: quien genera el PDF reporta los precios al ERP.
    if res["tipo"] == "pdf" and res.get("cot_id"):
        ui.aviso(
            "info", "Falta un paso: registrar los precios en el ERP",
            "Abre el correo, dale Enviar y marca «Ya lo envié». Así queda la evidencia del precio para el control.",
        )
        tarjeta_correo_erp(res["cot_id"], usuario, key=f"erp_res_{res['cot_id']}")


# ---------------------------------------------------------------------------
# Pantalla: Nueva cotizacion
# ---------------------------------------------------------------------------


def pantalla_nueva_cotizacion(usuario) -> None:
    resultado = st.session_state.get("nv_resultado")
    if resultado:
        _pantalla_resultado(usuario, resultado)
        return
    _init_estado_nueva()
    catalogo = _cargar_catalogo_cache()
    politica = database.obtener_politica()
    flete_val = flete_unitario(catalogo.flete)

    solicitado = st.session_state.pop("editar_cot_id_solicitado", None)
    if solicitado is not None:
        _cargar_a_sesion(solicitado)

    editando_id = st.session_state.get("nv_editar_id")
    cot_actual = database.obtener_cotizacion(editando_id) if editando_id else None
    if editando_id and cot_actual is None:
        _init_estado_nueva(force_reset=True)
        editando_id = None

    if cot_actual:
        ui.encabezado(
            "Editar cotización",
            f"{cot_actual['codigo']} · {estado_label(cot_actual['estado'])} · {cot_actual['cliente_nombre']}",
        )
    else:
        ui.encabezado(
            "Nueva cotización",
            "Elige el cliente, agrega los productos y envía. El margen se calcula solo.",
        )

    cliente_id, canal = _seccion_cliente(usuario)
    lineas_calc = _seccion_productos(usuario, catalogo, flete_val, politica, cliente_id)
    _seccion_resumen(usuario, editando_id, cliente_id, canal, lineas_calc)


def _seccion_cliente(usuario) -> tuple[int | None, str]:
    with ui.tarjeta():
        ui.titulo_seccion("Cliente", 1)
        izq, der = st.columns([1, 2.2], gap="medium")
        with izq:
            actual = {"existente": 0, "nuevo": 1}.get(st.session_state["nv_tipo_cliente"])
            tipo = st.radio(
                "Tipo de cliente *", ["Existente", "Nuevo"], index=actual, horizontal=True,
                key="nv_tipo_radio",
            )
            st.session_state["nv_tipo_cliente"] = {"Existente": "existente", "Nuevo": "nuevo"}.get(tipo)
            canal_actual = st.session_state["nv_canal"]
            # Una cotizacion vieja con un canal que ya no existe obliga a elegir uno vigente.
            canal = st.selectbox(
                "Canal *", CANALES, index=CANALES.index(canal_actual) if canal_actual in CANALES else None,
                placeholder="Elige el canal", key="nv_canal_sel",
            )
            st.session_state["nv_canal"] = canal
            if es_exportacion(canal):
                trm = st.number_input(
                    "TRM (COP por 1 USD) *", min_value=0.0, step=10.0,
                    value=float(st.session_state["nv_trm"]), format="%.2f", key="nv_trm_in",
                    help="Los precios se escriben en pesos; el PDF sale en dólares con esta TRM.",
                )
                st.session_state["nv_trm"] = float(trm)
            else:
                st.session_state["nv_trm"] = 0.0
        with der:
            preload = st.session_state.pop("nv_cliente_id_preload", None)
            if tipo is None:
                ui.aviso("info", "¿Cliente nuevo o existente?", "Elige una opción a la izquierda para continuar.")
                cliente_id = None
            elif tipo == "Nuevo":
                cliente_id = _form_cliente_nuevo(usuario, "nv")
            else:
                cliente_id = _form_cliente_existente("nv", preload)

        with st.expander("Condiciones comerciales"):
            a, b, c, d = st.columns([1.2, 0.8, 1.2, 1.6])
            st.session_state["nv_pago"] = a.text_input(
                "Condiciones de pago", value=st.session_state["nv_pago"], key="nv_pago_in",
            )
            st.session_state["nv_vig"] = int(b.number_input(
                "Vigencia (días)", min_value=1, max_value=180,
                value=int(st.session_state["nv_vig"]), key="nv_vig_in",
            ))
            st.session_state["nv_entrega"] = c.text_input(
                "Tiempo de entrega", value=st.session_state["nv_entrega"], key="nv_entrega_in",
            )
            st.session_state["nv_notas"] = d.text_input(
                "Observaciones para el cliente", value=st.session_state["nv_notas"], key="nv_notas_in",
                help="Salen en el PDF de la oferta.",
            )
        st.caption(
            f"Pago: {st.session_state['nv_pago'] or '—'} · Vigencia: {st.session_state['nv_vig']} días"
            f" · Entrega: {st.session_state['nv_entrega'] or '—'}"
        )
    return cliente_id, canal


_NOMBRES_TRAMO = ("Clientes pequeños", "Clientes medianos", "Clientes grandes")


def _texto_tramo(i: int, tramo: dict, total: int) -> str:
    if i == 0:
        rango = f"Hasta {fmt_miles(tramo['hasta'])} und/mes"
    elif i == total - 1:
        rango = f"Desde {fmt_miles(tramo['desde'])} und/mes"
    else:
        rango = f"{fmt_miles(tramo['desde'])} a {fmt_miles(tramo['hasta'])} und/mes"
    return f"{rango} · {tramo['clientes']} cliente{'s' if tramo['clientes'] != 1 else ''}"


def _panel_referencia(catalogo, producto: str, calibre: str, cliente_id: int | None) -> None:
    """Cuanto han pagado los clientes por esta referencia, para cotizar sin dejar plata en la mesa."""
    ref = referencias.referencia(catalogo, producto, calibre)
    if not ref or not ref["ventas"]:
        st.caption("Sin ventas registradas de esta referencia en el ERP: no hay precio de referencia.")
        return

    def detalle_venta(venta: dict | None) -> str:
        if not venta:
            return ""
        return f"{venta['cliente']} · {fmt_miles(venta['cantidad'])} und · {venta['fecha']}"

    with st.expander(f"Referencia de precios · {producto} {calibre}", expanded=True):
        datos = []
        if ref["maximo"]:
            datos.append(("Precio más alto", fmt_moneda(ref["maximo"]["precio"], 0), detalle_venta(ref["maximo"])))
        if ref["promedio"]:
            datos.append(("Precio medio del período", fmt_moneda(ref["promedio"], 0),
                          f"{ref['ventas']} ventas a {ref['clientes']} clientes"))
        if ref["promedio_reciente"]:
            tendencia = ref["tendencia"]
            datos.append(("Promedio últimos 3 meses", fmt_moneda(ref["promedio_reciente"], 0),
                          f"{'+' if tendencia >= 0 else '-'}{abs(tendencia) * 100:.0f}% frente al período"
                          if tendencia is not None else ""))
        if ref["minimo"]:
            datos.append(("Precio más bajo", fmt_moneda(ref["minimo"]["precio"], 0), detalle_venta(ref["minimo"])))
        ui.chips(datos)

        otros = []
        if ref["p25"] and ref["p75"]:
            otros.append(("Rango habitual", f"{fmt_moneda(ref['p25'], 0)} a {fmt_moneda(ref['p75'], 0)}",
                          "La mitad de las ventas está en este rango"))
        tramos = ref["tramos"]
        for i, tramo in enumerate(tramos):
            otros.append((_NOMBRES_TRAMO[i], fmt_moneda(tramo["precio"], 0), _texto_tramo(i, tramo, len(tramos))))
        if otros:
            ui.chips(otros)

        cliente = next((c["nombre"] for c in database.listar_clientes() if c["id"] == cliente_id), "") \
            if cliente_id else ""
        propio = referencias.precio_del_cliente(catalogo, producto, calibre, cliente)
        if propio:
            ui.aviso(
                "info", f"{cliente} ya compra esta referencia",
                f"Último precio {fmt_moneda(propio['ultimo_precio'], 0)} ({propio['fecha_ultimo']}); "
                f"promedio pagado {fmt_moneda(propio['precio_promedio'], 0)}; "
                f"compra cerca de {fmt_miles(propio['volumen_mensual'])} und al mes. "
                "No le cotices por debajo de lo que ya paga sin una razón (más volumen, competencia).",
            )
        st.caption(
            f"Ventas reales del ERP ({ref['periodo']}). Para no dejar margen en la mesa, compara con lo que pagan "
            "clientes de un tamaño parecido al tuyo: por debajo del rango habitual estarías entre los precios más "
            "bajos. El precio más alto suele ser un pedido pequeño. Al agregar la línea, «Vs. mercado» compara "
            "tu precio con clientes de volumen mensual parecido."
        )


def _seccion_productos(usuario, catalogo, flete_val: float, politica, cliente_id: int | None = None) -> pd.DataFrame:
    items = catalogo.items
    with ui.tarjeta():
        ui.titulo_seccion("Productos", 2)
        descripciones = sorted(items["DESCRIPCION"].dropna().astype(str).unique()) if not items.empty else []
        if not descripciones:
            ui.aviso("error", "El catálogo está vacío", "Pide al gerente que cargue el catálogo.")
            return pd.DataFrame()

        a, b = st.columns([2.4, 1.1])
        producto = a.selectbox(
            "Producto", descripciones, index=None, placeholder="Elige un producto", key="nv_prod_sel",
        )
        calibres = calibres_de_producto(items, producto) if producto else []
        calibre = b.selectbox(
            "Calibre", calibres, index=0 if calibres else None, placeholder="—",
            # La clave depende del producto: al cambiarlo, el calibre arranca en la primera opcion.
            disabled=not calibres, key=f"nv_cal_sel_{producto}",
        )
        if producto and calibre:
            _panel_referencia(catalogo, producto, calibre, cliente_id)

        # La unidad de empaque siempre la escribe el vendedor (unidades por caja).
        with st.form("nv_form_agregar", clear_on_submit=True, border=False):
            columnas = st.columns([0.9, 1.2, 1.4, 1.4, 1], vertical_alignment="bottom")
            impreso = columnas[0].selectbox("Impreso", ["si", "no"], format_func=lambda v: "Sí" if v == "si" else "No")
            empaque = columnas[1].number_input("Empaque (und) *", min_value=0, step=100, value=0)
            cantidad = columnas[2].number_input("Cantidad mes (und)", min_value=0, step=1000, value=0)
            precio = columnas[3].number_input("Precio unitario (COP)", min_value=0.0, step=1.0, value=0.0,
                                              format="%.2f")
            agregar = columnas[4].form_submit_button("Agregar", type="primary", use_container_width=True)
        if agregar:
            if not producto or not calibre:
                st.error("Elige el producto y el calibre.")
            elif not empaque:
                st.error("Escribe la unidad de empaque (unidades por caja).")
            elif cantidad <= 0:
                st.error("La cantidad debe ser mayor que 0.")
            elif precio <= 0:
                st.error("El precio debe ser mayor que 0.")
            else:
                st.session_state["nv_lineas"].append({
                    "producto": producto,
                    "calibre": calibre,
                    "impreso": impreso,
                    "empaque": int(empaque or 0),
                    "cantidad_mes": float(cantidad),
                    "precio": float(precio),
                })
                st.rerun()

        lineas = st.session_state["nv_lineas"]
        if not lineas:
            ui.vacio("Aún no hay productos. Elige uno, escribe empaque, cantidad y precio, y pulsa Agregar.")
            return pd.DataFrame()

        enriched = [
            _enriquecer_linea(l, items, catalogo.materiales, catalogo.costos_grupo, flete_val, politica)
            for l in lineas
        ]
        vista = _vista_lineas(enriched, usuario.rol == ROL_GERENTE, catalogo)
        evento = st.dataframe(
            ui.estilizar(vista, col_aprobacion=COL_APROBACION, col_mercado=COL_MERCADO),
            column_config=COLUMNAS_LINEAS,
            hide_index=True, use_container_width=True, on_select="rerun",
            selection_mode="multi-row", key=f"nv_tabla_{st.session_state['nv_tabla_ver']}",
        )
        seleccion = [i for i in (evento.selection.rows if evento else []) if i < len(lineas)]
        c1, c2 = st.columns([3, 1.2], vertical_alignment="center")
        c1.caption("Marca una o varias filas para quitarlas.")
        if c2.button(
            f"Quitar ({len(seleccion)})" if seleccion else "Quitar",
            disabled=not seleccion, use_container_width=True, key="nv_quitar",
        ):
            for i in sorted(seleccion, reverse=True):
                lineas.pop(i)
            st.session_state["nv_tabla_ver"] += 1
            st.rerun()
        return pd.DataFrame(enriched)


def _seccion_resumen(usuario, editando_id, cliente_id, canal: str, lineas_calc: pd.DataFrame) -> None:
    n = len(lineas_calc)
    venta = float(lineas_calc["venta_total"].sum()) if n else 0.0
    trm = float(st.session_state["nv_trm"])
    es_export = es_exportacion(canal)
    n_bajo = int(lineas_calc["aprobacion"].astype(bool).sum()) if n else 0
    requiere = n_bajo > 0

    with ui.tarjeta():
        ui.titulo_seccion("Resumen y envío", 3)
        izq, der = st.columns([1.15, 1], gap="large")
        with izq:
            flete = st.number_input(
                "Flete adicional (COP)", min_value=0.0, step=1000.0,
                value=float(st.session_state["nv_flete_adicional"]), key="nv_flete_in",
                help="Cargo único que se suma al total de la cotización.",
            )
            st.session_state["nv_flete_adicional"] = float(flete)
            total = venta + float(flete)
            filas = [("Productos", str(n)), ("Subtotal", fmt_moneda(venta, 0)),
                     ("Flete adicional", fmt_moneda(flete, 0))]
            if usuario.rol == ROL_GERENTE and n:
                margen = float(lineas_calc["margen_dinero"].sum())
                filas += [("Margen", fmt_moneda(margen, 0)),
                          ("UB% global", fmt_porcentaje(margen / venta if venta else 0, 1))]
            ui.resumen(filas, ("Total", fmt_moneda(total, 0)))
            if es_export and trm > 0:
                st.caption(f"En dólares: {fmt_usd(total / trm, 3)} (TRM {fmt_miles(trm, 2)})")

        with der:
            if n and requiere:
                ui.aviso(
                    "alerta", "Requiere aprobación del gerente",
                    f"{n_bajo} de {n} productos tienen margen bajo la política. Apenas se apruebe, "
                    "descargas el PDF con un clic desde Mis cotizaciones.",
                )
            elif n:
                ui.aviso("ok", "Lista para enviar", "Todos los productos cumplen la política de margen.")

            faltantes = []
            if st.session_state["nv_tipo_cliente"] is None:
                faltantes.append("indicar si el cliente es nuevo o existente")
            elif cliente_id is None:
                faltantes.append("elegir o crear el cliente")
            if not canal:
                faltantes.append("elegir el canal")
            if es_export and trm <= 0:
                faltantes.append("escribir la TRM")
            if not n:
                faltantes.append("agregar al menos un producto")
            bloqueado = bool(faltantes)
            if faltantes:
                st.caption("Para continuar falta: " + ", ".join(faltantes) + ".")

            def datos_resultado(codigo: str) -> dict:
                cliente = next((c["nombre"] for c in database.listar_clientes() if c["id"] == cliente_id), "")
                return {"codigo": codigo, "cliente": cliente, "total": fmt_moneda(total, 0)}

            def guardar(estado: str) -> tuple[int, str]:
                return _persistir(
                    usuario, editando_id, cliente_id, canal,
                    st.session_state["nv_pago"], st.session_state["nv_vig"],
                    st.session_state["nv_entrega"], st.session_state["nv_notas"], float(flete),
                    trm if es_export else None, st.session_state["nv_tipo_cliente"] == "nuevo",
                    lineas_calc, estado=estado,
                )

            if requiere:
                if st.button("Enviar a aprobación", type="primary", use_container_width=True,
                             disabled=bloqueado, key="nv_btn_aprob"):
                    _, codigo = guardar(ESTADO_PENDIENTE_APROBACION)
                    _terminar({"tipo": "aprobacion", **datos_resultado(codigo)})
            elif st.button("Generar PDF", type="primary", use_container_width=True,
                           disabled=bloqueado, key="nv_btn_pdf"):
                cot_id, codigo = guardar(ESTADO_BORRADOR)
                with st.spinner("Generando el PDF con el formato de Kos…"):
                    data, nombre = pdf_de_cotizacion(cot_id)
                database.promover_a_enviada_si_corresponde(cot_id, usuario.nombre)
                _terminar({"tipo": "pdf", "data": data, "file_name": nombre, "cot_id": cot_id,
                           **datos_resultado(codigo)})

            b1, b2 = st.columns(2)
            if b1.button("Guardar borrador", use_container_width=True, disabled=bloqueado,
                         key="nv_btn_borrador"):
                _, codigo = guardar(ESTADO_BORRADOR)
                _terminar({"tipo": "borrador", **datos_resultado(codigo)})
            if b2.button("Salir sin guardar" if editando_id else "Empezar de nuevo",
                         use_container_width=True, key="nv_btn_limpiar"):
                _terminar(None)


def _persistir(
    usuario, editando_id, cliente_id, canal, condiciones, vigencia, entrega, notas,
    flete_adicional: float, trm: float | None, cliente_es_nuevo: bool,
    lineas_calc: pd.DataFrame, estado: str,
) -> tuple[int, str]:
    """Crea una cotizacion nueva o actualiza la que se esta editando, y guarda lineas."""
    if editando_id:
        database.actualizar_cabecera(
            editando_id, canal=canal, condiciones_pago=condiciones,
            vigencia_dias=int(vigencia), tiempo_entrega=entrega, notas=notas,
            flete_adicional=flete_adicional, trm=trm,
            cliente_es_nuevo=1 if cliente_es_nuevo else 0, cliente_id=cliente_id,
        )
        cot_id = editando_id
        codigo = database.obtener_cotizacion(cot_id)["codigo"]
    else:
        cot_id, codigo = database.crear_cotizacion(
            vendedor=usuario.nombre,
            cliente_id=cliente_id,
            canal=canal,
            condiciones_pago=condiciones,
            vigencia_dias=int(vigencia),
            tiempo_entrega=entrega,
            notas=notas,
            flete_adicional=flete_adicional,
            trm=trm,
            cliente_es_nuevo=cliente_es_nuevo,
        )
    filas = []
    for _, r in lineas_calc.iterrows():
        filas.append({
            "producto": str(r["producto"]),
            "calibre": str(r["calibre"]),
            "impreso": str(r["impreso"]),
            "empaque": int(r["empaque"] or 0),
            "cantidad_mes": float(r["cantidad_mes"] or 0),
            "precio": float(r["precio"] or 0),
            "costo_unit": float(r["costo_unit"] or 0),
            "flete_unit": float(r["flete_unit"] or 0),
            "ub_pct": float(r["ub_pct"]) if pd.notna(r["ub_pct"]) else None,
            "aprobacion_txt": str(r["aprobacion"]),
        })
    database.reemplazar_lineas(cot_id, filas)
    database.actualizar_estado_cotizacion(cot_id, estado, usuario.nombre)
    return cot_id, codigo


# ---------------------------------------------------------------------------
# Pantalla: Mis cotizaciones (y "Cotizaciones" del gerente)
# ---------------------------------------------------------------------------


def pantalla_mis_cotizaciones(usuario) -> None:
    es_gerente = usuario.rol == ROL_GERENTE
    if st.session_state.get("mc_ver"):
        _vista_cotizacion(usuario, int(st.session_state["mc_ver"]))
        return
    if es_gerente:
        ui.encabezado("Cotizaciones", "Todas las cotizaciones del equipo. Pulsa «Ver» para abrir una.")
    else:
        ui.encabezado("Mis cotizaciones", "Descarga las aprobadas, ajusta las rechazadas y pulsa «Ver» para abrir una.")

    flash = st.session_state.pop("mc_flash", None)
    if flash:
        ui.aviso(*flash)
    _correo_erp_abierto(usuario)
    if not es_gerente:
        _panel_atencion(usuario)
    else:
        pendientes = pendientes_correo_erp()
        if pendientes:
            n = len(pendientes)
            ui.aviso("alerta", f"{n} {'cotización enviada' if n == 1 else 'cotizaciones enviadas'} sin correo al ERP",
                     "En el listado salen con «Correo ERP: Pendiente». Cada ejecutivo lo tiene listo en "
                     "Mis cotizaciones.")

    cots = database.listar_cotizaciones_con_totales(vendedor=None if es_gerente else usuario.nombre)
    if not cots:
        ui.vacio("Todavía no hay cotizaciones. Crea la primera en Nueva cotización.")
        return

    df = pd.DataFrame(cots)
    f1, f2 = st.columns([2, 1.2])
    buscar = f1.text_input("Buscar", placeholder="Buscar por cliente o código", key="mc_buscar",
                           label_visibility="collapsed")
    presentes = [e for e in ESTADO_LABEL if e in set(df["estado"])]
    filtro = f2.selectbox(
        "Estado", ["todos"] + presentes, key="mc_estado", label_visibility="collapsed",
        format_func=lambda e: "Todos los estados" if e == "todos" else estado_label(e),
    )
    if buscar:
        df = df[
            df["cliente_nombre"].str.contains(buscar, case=False, na=False, regex=False)
            | df["codigo"].str.contains(buscar, case=False, na=False, regex=False)
        ]
    if filtro != "todos":
        df = df[df["estado"] == filtro]
    df = df.reset_index(drop=True)
    if df.empty:
        ui.vacio("No hay cotizaciones con ese filtro.")
        return
    _listado_cotizaciones(df, es_gerente)


_POR_PAGINA = 20


def _listado_cotizaciones(df: pd.DataFrame, es_gerente: bool) -> None:
    """Una fila por cotizacion con su boton «Ver», que abre la ficha completa."""
    mostrar = int(st.session_state.get("mc_mostrar", _POR_PAGINA))
    for cot in df.head(mostrar).to_dict("records"):
        detalle = [str(cot["fecha"])[:10], f"{int(cot['n_items'])} ítem{'s' if int(cot['n_items']) != 1 else ''}"]
        if es_gerente:
            detalle.insert(1, cot["vendedor"])
        correo = texto_estado_correo(cot)
        if correo != "—":
            detalle.append(f"Correo ERP: {correo}")
        with ui.tarjeta():
            c1, c2, c3, c4 = st.columns([3, 1.2, 1.2, 0.8], vertical_alignment="center")
            c1.markdown(
                f"<div class='kos-cot'><b>{ui.esc(cot['codigo'])} · {ui.esc(cot['cliente_nombre'])}</b><br>"
                f"<small>{ui.esc(' · '.join(detalle))}</small></div>",
                unsafe_allow_html=True,
            )
            c2.markdown(ui.pastilla_estado(cot["estado"]), unsafe_allow_html=True)
            c3.markdown(f"<div class='kos-monto'>{ui.esc(fmt_moneda(cot['valor_total'], 0))}</div>",
                        unsafe_allow_html=True)
            if c4.button("Ver", key=f"ver_{cot['id']}", use_container_width=True):
                st.session_state["mc_ver"] = int(cot["id"])
                st.rerun()
    if len(df) > mostrar:
        if st.button(f"Mostrar más ({len(df) - mostrar} restantes)", key="mc_mas"):
            st.session_state["mc_mostrar"] = mostrar + _POR_PAGINA
            st.rerun()


@st.cache_data(show_spinner=False, max_entries=12)
def _paginas_pdf(data: bytes) -> list[bytes]:
    """Paginas del PDF como imagenes, para verlo dentro de la app sin descargarlo."""
    import io

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(data)
    try:
        paginas = []
        for i in range(len(pdf)):
            imagen = pdf[i].render(scale=1.6).to_pil()
            buf = io.BytesIO()
            imagen.save(buf, format="PNG")
            paginas.append(buf.getvalue())
        return paginas
    finally:
        pdf.close()


def _historial(cot: dict) -> pd.DataFrame:
    """Lo que ha pasado con la cotizacion: creacion, aprobaciones, seguimiento y correo al ERP."""
    filas = [(str(cot["fecha"]), "Creada", cot["vendedor"], "")]
    for d in database.aprobaciones_de(int(cot["id"])):
        filas.append((d["creado_en"], "Aprobada" if d["decision"] == "aprobada" else "Rechazada",
                      d["usuario"], d.get("motivo") or ""))
    for s in database.listar_seguimientos(int(cot["id"])):
        texto = " · ".join(x for x in (s.get("motivo"), s.get("feedback_cliente")) if x)
        filas.append((s["creado_en"], f"Seguimiento: {estado_label(s['estado'])}", s.get("creado_por") or "", texto))
    if cot.get("erp_correo_en"):
        filas.append((cot["erp_correo_en"], "Correo al ERP enviado", cot.get("erp_correo_por") or "", ""))
    df = pd.DataFrame(filas, columns=["Cuándo", "Qué pasó", "Quién", "Detalle"]).sort_values("Cuándo")
    df["Cuándo"] = df["Cuándo"].astype(str).str[:16].str.replace("T", " ")
    return df


def _vista_cotizacion(usuario, cot_id: int) -> None:
    """Ficha completa de una cotizacion ya hecha (vendedor: las suyas; gerente: todas)."""
    es_gerente = usuario.rol == ROL_GERENTE
    cot = database.obtener_cotizacion(int(cot_id))
    if not cot or (not es_gerente and cot["vendedor"] != usuario.nombre):
        st.session_state.pop("mc_ver", None)
        ui.aviso("error", "No encontramos esa cotización", "Vuelve al listado y elige otra.")
        return
    volver = "Volver a Cotizaciones" if es_gerente else "Volver a Mis cotizaciones"
    if st.button(f"← {volver}", key="mc_volver"):
        st.session_state.pop("mc_ver", None)
        st.rerun()
    ui.encabezado(f"{cot['codigo']} · {cot['cliente_nombre']}",
                  f"{estado_label(cot['estado'])} · {str(cot['fecha'])[:10]} · {cot['vendedor']}")
    flash = st.session_state.pop("mc_flash", None)
    if flash:
        ui.aviso(*flash)
    _correo_erp_abierto(usuario)
    _detalle_cotizacion(usuario, cot)

    lineas = database.listar_lineas(int(cot["id"]))
    requiere = any((l.get("aprobacion_txt") or "").strip() for l in lineas)
    permitido, _ = puede_generar_pdf(cot["estado"], requiere)
    if permitido and lineas:
        with ui.tarjeta():
            ui.titulo_seccion("La oferta en PDF")
            if st.toggle("Ver la oferta como la recibe el cliente", key=f"ver_pdf_{cot['id']}"):
                try:
                    with st.spinner("Preparando la oferta…"):
                        data, _ = pdf_de_cotizacion(int(cot["id"]))
                        paginas = _paginas_pdf(data)
                    st.image(paginas, use_column_width=True)
                except Exception as exc:  # noqa: BLE001 - se informa y se sigue
                    ui.aviso("error", "No se pudo mostrar el PDF", str(exc))
            st.caption("Verla aquí no la marca como enviada; «Descargar PDF» sí.")

    with ui.tarjeta():
        ui.titulo_seccion("Historial")
        st.dataframe(_historial(cot), hide_index=True, use_container_width=True)


def _ultima_decision(cot_id: int) -> dict:
    decisiones = database.aprobaciones_de(int(cot_id))
    return decisiones[0] if decisiones else {}


def _correo_erp_abierto(usuario) -> None:
    """Correo al ERP de la cotizacion recien descargada o elegida en «Correo al ERP pendiente»."""
    cot_id = st.session_state.get("mc_correo_erp")
    if not cot_id:
        return

    def cerrar() -> None:
        st.session_state.pop("mc_correo_erp", None)
        st.rerun()

    ui.aviso("info", "Falta un paso: registrar los precios en el ERP",
             "Abre el correo, dale Enviar y marca «Ya lo envié». Así queda la evidencia del precio para el control.")
    tarjeta_correo_erp(int(cot_id), usuario, key=f"erp_mc_{cot_id}", al_cerrar=cerrar)


def _panel_atencion(usuario) -> None:
    aprobadas = database.listar_cotizaciones_con_totales(vendedor=usuario.nombre, estado=ESTADO_APROBADA)
    rechazadas = database.listar_cotizaciones_con_totales(vendedor=usuario.nombre, estado=ESTADO_RECHAZADA)
    en_aprobacion = database.listar_cotizaciones(vendedor=usuario.nombre, estado=ESTADO_PENDIENTE_APROBACION)
    sin_correo = [c for c in pendientes_correo_erp(usuario.nombre)
                  if c["id"] != st.session_state.get("mc_correo_erp")]

    if sin_correo:
        ui.titulo_seccion(f"Correo al ERP pendiente ({len(sin_correo)})")
        st.caption("Ofertas ya enviadas al cliente cuyos precios falta reportar a quien los registra en el ERP.")
        for cot in sin_correo:
            with ui.tarjeta():
                c1, c2, c3 = st.columns([2.7, 1.1, 1.3], vertical_alignment="center")
                c1.markdown(
                    f"<div class='kos-cot'><b>{ui.esc(cot['codigo'])} · {ui.esc(cot['cliente_nombre'])}</b><br>"
                    f"<small>{ui.esc(estado_label(cot['estado']))} · {ui.esc(str(cot['fecha'])[:10])}</small></div>",
                    unsafe_allow_html=True,
                )
                c2.markdown(f"<div class='kos-monto'>{ui.esc(fmt_moneda(cot['valor_total'], 0))}</div>",
                            unsafe_allow_html=True)
                if c3.button("Preparar correo", type="primary", use_container_width=True,
                             key=f"erp_pend_{cot['id']}"):
                    st.session_state["mc_correo_erp"] = int(cot["id"])
                    st.rerun()

    if aprobadas:
        ui.titulo_seccion(f"Listas para enviar ({len(aprobadas)})")
        for cot in aprobadas:
            dec = _ultima_decision(cot["id"])
            cuando = (dec.get("creado_en") or "")[:16].replace("T", " ")
            nota = f" · «{dec['motivo']}»" if (dec.get("motivo") or "").strip() else ""
            with ui.tarjeta():
                c1, c2, c3 = st.columns([2.7, 1.1, 1.3], vertical_alignment="center")
                c1.markdown(
                    f"<div class='kos-cot'><b>{ui.esc(cot['codigo'])} · {ui.esc(cot['cliente_nombre'])}</b><br>"
                    f"<small>Aprobada por {ui.esc(dec.get('usuario', 'el gerente'))}"
                    f"{' · ' + ui.esc(cuando) if cuando else ''}"
                    f"{ui.esc(nota)}</small></div>",
                    unsafe_allow_html=True,
                )
                c2.markdown(f"<div class='kos-monto'>{ui.esc(fmt_moneda(cot['valor_total'], 0))}</div>",
                            unsafe_allow_html=True)
                with c3:
                    _boton_descargar_pdf(usuario, cot, key=f"dl_aprob_{cot['id']}")

    if rechazadas:
        ui.titulo_seccion(f"Rechazadas ({len(rechazadas)})")
        for cot in rechazadas:
            dec = _ultima_decision(cot["id"])
            motivo = (dec.get("motivo") or "").strip()
            with ui.tarjeta():
                c1, c2 = st.columns([3.8, 1.3], vertical_alignment="center")
                c1.markdown(
                    f"<div class='kos-cot'><b>{ui.esc(cot['codigo'])} · {ui.esc(cot['cliente_nombre'])}</b><br>"
                    f"<small>Rechazada por {ui.esc(dec.get('usuario', 'el gerente'))}"
                    f"{': ' + ui.esc(motivo) if motivo else ''}</small></div>",
                    unsafe_allow_html=True,
                )
                if c2.button("Ajustar y reenviar", key=f"edit_rech_{cot['id']}",
                             use_container_width=True):
                    st.session_state["editar_cot_id_solicitado"] = int(cot["id"])
                    st.session_state["pagina"] = "nueva"
                    st.rerun()

    if en_aprobacion:
        n = len(en_aprobacion)
        ui.aviso(
            "info",
            f"{n} {'cotización' if n == 1 else 'cotizaciones'} en aprobación",
            "El gerente las está revisando. Aparecerán arriba, listas para descargar, apenas las apruebe.",
        )

    if aprobadas or rechazadas or en_aprobacion or sin_correo:
        st.write("")
        ui.titulo_seccion("Todas")


def _detalle_cotizacion(usuario, cot: dict) -> None:
    es_gerente = usuario.rol == ROL_GERENTE
    lineas = database.listar_lineas(int(cot["id"]))
    cot_full = database.obtener_cotizacion(int(cot["id"])) or cot

    with ui.tarjeta():
        c1, c2 = st.columns([3, 1.3], vertical_alignment="center")
        tipo_cli = "Cliente nuevo" if int(cot_full.get("cliente_es_nuevo") or 0) == 1 else "Cliente existente"
        c1.markdown(
            f"<div class='kos-seccion'>{ui.esc(cot_full['codigo'])} · {ui.esc(cot_full['cliente_nombre'])} "
            f"{ui.pastilla_estado(cot_full['estado'])}</div>"
            f"<div class='kos-cot'><small>{ui.esc(str(cot_full['fecha'])[:10])} · {ui.esc(cot_full.get('canal') or '—')}"
            f" · {ui.esc(cot_full['vendedor'])} · {tipo_cli} · Vigencia {ui.esc(cot_full.get('vigencia_dias') or 15)} días"
            f"</small></div>",
            unsafe_allow_html=True,
        )

        requiere = any((l.get("aprobacion_txt") or "").strip() for l in lineas)
        permitido, razon = puede_generar_pdf(cot_full["estado"], requiere)
        with c2:
            if cot_full["estado"] in ESTADOS_EDITABLES and (es_gerente or cot_full["vendedor"] == usuario.nombre):
                if st.button("Editar", key=f"edit_{cot_full['id']}", use_container_width=True):
                    st.session_state["editar_cot_id_solicitado"] = int(cot_full["id"])
                    st.session_state["pagina"] = "nueva"
                    st.session_state.pop("mc_ver", None)
                    st.rerun()
            if permitido and lineas:
                _boton_descargar_pdf(usuario, cot_full, key=f"dl_det_{cot_full['id']}")

        if not lineas:
            ui.vacio("Esta cotización no tiene productos.")
            return

        st.dataframe(
            ui.estilizar(_vista_lineas(lineas, es_gerente, _cargar_catalogo_cache()),
                         col_aprobacion=COL_APROBACION, col_mercado=COL_MERCADO),
            column_config=COLUMNAS_LINEAS, hide_index=True, use_container_width=True,
        )

        venta = sum(float(l["precio"] or 0) * float(l["cantidad_mes"] or 0) for l in lineas)
        flete = float(cot_full.get("flete_adicional") or 0)
        total = venta + flete
        _, col_tot = st.columns([1.6, 1])
        with col_tot:
            filas = [("Subtotal", fmt_moneda(venta, 0)), ("Flete adicional", fmt_moneda(flete, 0))]
            trm = float(cot_full.get("trm") or 0)
            if es_exportacion(cot_full.get("canal")) and trm > 0:
                filas.append(("En dólares", fmt_usd(total / trm, 3)))
            ui.resumen(filas, ("Total", fmt_moneda(total, 0)))
        if not permitido:
            st.caption(f"PDF no disponible: {razon}")

    if puede_ver_correo_erp(usuario, cot_full, lineas):
        estado = texto_estado_correo(cot_full)
        abierto_arriba = st.session_state.get("mc_correo_erp") == int(cot_full["id"])
        with st.expander(f"Correo para registrar los precios en el ERP · {estado}",
                         expanded=estado == "Pendiente" and not abierto_arriba):
            tarjeta_correo_erp(int(cot_full["id"]), usuario, key=f"erp_det_{cot_full['id']}")
