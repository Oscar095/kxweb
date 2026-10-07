"""Vistas exclusivas del gerente: aprobaciones, politica de margen y usuarios."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st

from .. import correo_erp, database, datos_erp, ui, usuarios
from ..config import (
    CATALOGO_XLSX, ESTADO_APROBADA, ESTADO_PENDIENTE_APROBACION, ESTADO_RECHAZADA, ROL_GERENTE, es_exportacion,
)
from ..formato import fmt_moneda, fmt_porcentaje, fmt_usd
from .erp import responsable_erp
from .vendedor import (
    COL_APROBACION, COL_MERCADO, COLUMNAS_LINEAS, _cargar_catalogo_cache, _vista_lineas,
    pdf_de_cotizacion,
)


# ---------------------------------------------------------------------------
# Aprobaciones
# ---------------------------------------------------------------------------


def _alertas_costo(lineas: list[dict], catalogo) -> list[tuple[str, str]]:
    """Solo para el gerente: costos dudosos del catalogo (REVISAR_COSTO) y costos que
    cambiaron en el catalogo despues de hacer la cotizacion."""
    items = getattr(catalogo, "items", None)
    if items is None or items.empty:
        return []
    alertas = []
    for l in lineas:
        m = items[(items["DESCRIPCION"].astype(str) == str(l["producto"]))
                  & (items["CALIBRE"].astype(str) == str(l["calibre"]))]
        if m.empty:
            continue
        r = m.iloc[0]
        partes = []
        nota = r.get("REVISAR_COSTO")
        if isinstance(nota, str) and nota.strip():
            partes.append(nota.strip())
        guardado, actual = float(l.get("costo_unit") or 0), pd.to_numeric(r.get("COSTO"), errors="coerce")
        if guardado > 0 and pd.notna(actual) and abs(float(actual) - guardado) / guardado > 0.02:
            partes.append(f"Costo al cotizar {fmt_moneda(guardado, 2)}; hoy en el catálogo "
                          f"{fmt_moneda(float(actual), 2)} (el UB% de la tabla usa el costo al cotizar)")
        if partes:
            alertas.append((f"{l['producto']} {l['calibre']}", ". ".join(partes)))
    return alertas


def pantalla_aprobaciones(usuario) -> None:
    ui.encabezado("Aprobaciones", "Cotizaciones con al menos un producto bajo la política de margen.")
    flash = st.session_state.pop("apr_flash", None)
    if flash:
        ui.aviso(*flash)

    cots =database.listar_cotizaciones_con_totales(estado=ESTADO_PENDIENTE_APROBACION)
    if not cots:
        ui.vacio("No hay cotizaciones esperando aprobación.")
        return

    por_id = {c["id"]: c for c in cots}
    elegido = st.selectbox(
        f"Pendientes ({len(cots)})", list(por_id),
        format_func=lambda i: (
            f"{por_id[i]['codigo']} · {por_id[i]['cliente_nombre']} · {por_id[i]['vendedor']}"
            f" · {fmt_moneda(por_id[i]['valor_total'], 0)}"
        ),
        key="apr_sel",
    )
    cot = database.obtener_cotizacion(elegido)
    lineas = database.listar_lineas(elegido)

    with ui.tarjeta():
        ui.titulo_seccion(f"{cot['codigo']} · {cot['cliente_nombre']}")
        st.caption(
            f"Vendedor: {cot['vendedor']} · Canal: {cot.get('canal') or '—'} · "
            f"Pago: {cot.get('condiciones_pago') or '—'} · Vigencia: {cot.get('vigencia_dias') or 15} días"
        )
        st.dataframe(
            ui.estilizar(_vista_lineas(lineas, es_gerente=True, catalogo=_cargar_catalogo_cache()),
                         col_aprobacion=COL_APROBACION, col_mercado=COL_MERCADO),
            column_config=COLUMNAS_LINEAS, hide_index=True, use_container_width=True,
            column_order=["Producto", "Calibre", "Cantidad mes", "Precio", COL_MERCADO,
                          "Costo total u.", "Margen $", "UB%", COL_APROBACION],
        )
        for producto, texto in _alertas_costo(lineas, _cargar_catalogo_cache()):
            ui.aviso("alerta", f"Costo a revisar · {producto}", texto)

        venta = sum(float(l["precio"] or 0) * float(l["cantidad_mes"] or 0) for l in lineas)
        margen = sum(
            (float(l["precio"] or 0) - float(l["costo_unit"] or 0) - float(l["flete_unit"] or 0))
            * float(l["cantidad_mes"] or 0)
            for l in lineas
        )
        flete = float(cot.get("flete_adicional") or 0)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Subtotal", fmt_moneda(venta, 0))
        c2.metric("Total oferta", fmt_moneda(venta + flete, 0))
        c3.metric("Margen", fmt_moneda(margen, 0))
        c4.metric("UB% global", fmt_porcentaje(margen / venta if venta else 0, 1))
        trm = float(cot.get("trm") or 0)
        if es_exportacion(cot.get("canal")) and trm > 0:
            st.caption(f"Exportación: el cliente verá {fmt_usd((venta + flete) / trm, 3)} (TRM {trm:,.2f}).")

        motivo = st.text_area(
            "Comentario para el vendedor", placeholder="Opcional al aprobar; recomendado al rechazar.",
            key=f"motivo_{elegido}", height=80,
        )
        a, r, _ = st.columns([1.3, 1, 2])
        if a.button("Aprobar", type="primary", use_container_width=True, key="apr_ok"):
            database.registrar_aprobacion(elegido, "aprobada", usuario.nombre, motivo)
            database.actualizar_estado_cotizacion(elegido, ESTADO_APROBADA, usuario.nombre)
            with st.spinner("Dejando listo el PDF para el vendedor…"):
                try:
                    pdf_de_cotizacion(elegido)  # queda en cache: el vendedor descarga al instante
                except Exception:
                    pass  # se generara cuando el vendedor lo pida
            # El correo al ERP lo envia el ejecutivo al descargar el PDF (lleva esta aprobacion como evidencia).
            donde = (
                "Ya puedes descargar el PDF desde Cotizaciones; al hacerlo queda listo el correo para el ERP."
                if cot["vendedor"] == usuario.nombre
                else f"{cot['vendedor']} ya puede descargar el PDF con un clic desde Mis cotizaciones; "
                     "al hacerlo le queda listo el correo para el ERP con tu aprobación como evidencia."
            )
            st.session_state["apr_flash"] = ("ok", f"{cot['codigo']} aprobada", donde)
            st.rerun()
        if r.button("Rechazar", use_container_width=True, key="apr_no"):
            database.registrar_aprobacion(elegido, "rechazada", usuario.nombre, motivo)
            database.actualizar_estado_cotizacion(elegido, ESTADO_RECHAZADA, usuario.nombre)
            st.session_state["apr_flash"] = (
                "info", f"{cot['codigo']} rechazada",
                f"{cot['vendedor']} la verá en Mis cotizaciones para ajustarla y reenviarla.",
            )
            st.rerun()


# ---------------------------------------------------------------------------
# Politica de margen
# ---------------------------------------------------------------------------


def pantalla_configuracion(usuario) -> None:
    ui.encabezado("Configuración", "Política de margen, responsable del ERP y cargas de datos del ERP.")
    flash = st.session_state.pop("pol_flash", None)
    if flash:
        ui.aviso("ok", flash)
    pol = database.obtener_politica()
    col, col_erp = st.columns([1.4, 1], gap="large")
    with col:
        with ui.tarjeta():
            ui.titulo_seccion("Política de margen")
            a, b = st.columns(2)
            uc = a.number_input(
                "Aprobación comercial por debajo de (%)", min_value=0.0, max_value=100.0,
                value=round(pol.umbral_comercial * 100, 2), step=1.0, format="%.1f",
            )
            uf = b.number_input(
                "Aprobación comercial y financiera por debajo de (%)", min_value=0.0, max_value=100.0,
                value=round(pol.umbral_financiero * 100, 2), step=1.0, format="%.1f",
            )
            st.caption(
                f"UB% ≥ {uc:.1f}%: sin aprobación · entre {uf:.1f}% y {uc:.1f}%: comercial · "
                f"menor a {uf:.1f}%: comercial y financiera."
            )
            if uf > uc:
                st.error("El umbral financiero debe ser menor o igual al comercial.")
            if st.button("Guardar política", type="primary", disabled=uf > uc):
                database.actualizar_politica(uc / 100, uf / 100, usuario.nombre)
                st.session_state["pol_flash"] = "Política actualizada. Aplica a las cotizaciones nuevas."
                st.rerun()
    with col_erp:
        with ui.tarjeta():
            ui.titulo_seccion("Registro de precios en el ERP")
            st.caption("Cuando el ejecutivo genera o descarga el PDF, la app le deja listo el correo para "
                       "esta persona con los precios y su evidencia, para que los registre en el ERP.")
            actual = responsable_erp()
            with st.form("cfg_erp", border=False):
                nombre = st.text_input("Nombre del responsable", value=actual["nombre"])
                correo = st.text_input("Correo", value=actual["correo"], placeholder="nombre@koscolombia.com")
                guardar = st.form_submit_button("Guardar responsable", type="primary")
            if guardar:
                correo = correo.strip()
                if correo and ("@" not in correo or " " in correo):
                    st.error("El correo no es válido.")
                else:
                    database.guardar_parametro(correo_erp.PARAM_ERP_NOMBRE, " ".join(nombre.split()), usuario.nombre)
                    database.guardar_parametro(correo_erp.PARAM_ERP_CORREO, correo, usuario.nombre)
                    st.session_state["pol_flash"] = "Responsable del ERP guardado."
                    st.rerun()
    _seccion_datos_erp()


def _resultado_carga() -> None:
    """Resumen de la ultima carga del ERP (se muestra una vez)."""
    resultado = st.session_state.pop("erp_resultado", None)
    if not resultado:
        return
    tipo, r = resultado
    if tipo == "inventario":
        ui.aviso("ok", "Inventario cargado",
                 f"{r['productos']} productos a cotizar · {r['revisar']} con costo para revisar · "
                 f"{len(r['excluidos'])} excluidos de la lista ({', '.join(r['excluidos']) or 'ninguno'}).")
        informe = Path(r["informe"])
        if informe.exists():
            st.download_button("Descargar informe de costos", informe.read_bytes(), file_name=informe.name,
                               key="erp_informe")
    elif tipo == "ventas":
        c = r["clientes"]
        ui.aviso("ok", "Ventas cargadas",
                 f"Clientes: {c['nuevos']} nuevos, {c['actualizados']} actualizados, {c['inactivados']} inactivados. "
                 f"Vendedores desactivados: {', '.join(r['desactivados']) or 'ninguno'}. "
                 "Referencia de precios actualizada.")
        if r["creados"]:
            ui.aviso("alerta", "Vendedores nuevos con clave temporal",
                     "Anótalas y entrégalas: no se vuelven a mostrar. Al entrar deberán cambiarla.")
            st.dataframe(pd.DataFrame({"Usuario": list(r["creados"]), "Clave temporal": list(r["creados"].values())}),
                         hide_index=True)
    elif tipo == "catalogo":
        ui.aviso("ok", "Catálogo reemplazado", "La versión anterior quedó guardada en la carpeta histórico.")


def _seccion_datos_erp() -> None:
    """Cargas del ERP y respaldos (en Azure no hay consola: todo se hace desde aqui)."""
    with ui.tarjeta():
        ui.titulo_seccion("Datos del ERP")
        st.caption("Los usuarios ven los datos nuevos al recargar la página (F5).")
        _resultado_carga()
        inv_col, ven_col = st.columns(2, gap="large")
        with inv_col:
            st.markdown("**Inventario: costos y productos**")
            st.caption("Excel de inventarios del ERP con costo promedio y último costo (.xls o .xlsx). "
                       "Es la única fuente del costo y define la lista de productos a cotizar.")
            inv = st.file_uploader("Inventario", type=["xls", "xlsx"], key="erp_inv", label_visibility="collapsed")
            if st.button("Cargar inventario", type="primary", disabled=inv is None, key="erp_inv_btn"):
                try:
                    with st.spinner("Calculando costos…"):
                        r = datos_erp.cargar_inventario(inv.name, inv.getvalue())
                except Exception as exc:  # noqa: BLE001 - se informa al gerente
                    st.error(f"No se pudo cargar el inventario: {exc}")
                else:
                    st.session_state["erp_resultado"] = ("inventario", {
                        "productos": len(r["items"]), "revisar": int((r["items"]["REVISAR_COSTO"] != "").sum()),
                        "excluidos": list(r["excluidos"]["DESCRIPCION"]), "informe": str(r["informe"]),
                    })
                    st.session_state.pop("catalogo", None)
                    st.rerun()
        with ven_col:
            st.markdown("**Ventas: clientes, vendedores y precios**")
            st.caption("Excel de ventas del ERP con el detalle de remisiones (.xlsx). Actualiza clientes, "
                       "vendedores y la referencia de precios; no toca los costos.")
            ven = st.file_uploader("Ventas", type=["xlsx", "xls"], key="erp_ven", label_visibility="collapsed")
            if st.button("Cargar ventas", type="primary", disabled=ven is None, key="erp_ven_btn"):
                try:
                    with st.spinner("Actualizando clientes, vendedores y precios…"):
                        r = datos_erp.cargar_ventas(ven.name, ven.getvalue())
                except Exception as exc:  # noqa: BLE001 - se informa al gerente
                    st.error(f"No se pudo cargar el archivo de ventas: {exc}")
                else:
                    v = r["vendedores"]
                    st.session_state["erp_resultado"] = ("ventas", {
                        "clientes": r["clientes"], "creados": v["creados"], "desactivados": v["desactivados"],
                    })
                    st.session_state.pop("catalogo", None)
                    st.rerun()

        st.divider()
        cat_col, resp_col, sub_col = st.columns([1, 1, 1.6], gap="large")
        with cat_col:
            st.markdown("**Catálogo**")
            st.caption("Para revisar costos o llenar la hoja AjustesCosto.")
            if CATALOGO_XLSX.exists():
                st.download_button("Descargar catálogo", CATALOGO_XLSX.read_bytes(), file_name="catalogo.xlsx",
                                   use_container_width=True, key="erp_dl_cat")
        with resp_col:
            st.markdown("**Respaldo**")
            st.caption("Base de datos y catálogo en un .zip.")
            st.download_button("Descargar respaldo", datos_erp.respaldo_zip(),
                               file_name=f"respaldo_cotizador_{datetime.now():%Y-%m-%d}.zip",
                               use_container_width=True, key="erp_dl_resp")
        with sub_col:
            st.markdown("**Subir catálogo corregido**")
            st.caption("Reemplaza el catálogo. Los ajustes de la hoja AjustesCosto se aplican en la "
                       "siguiente carga del inventario.")
            cat = st.file_uploader("Catálogo", type=["xlsx"], key="erp_cat", label_visibility="collapsed")
            if st.button("Reemplazar catálogo", disabled=cat is None, key="erp_cat_btn"):
                try:
                    datos_erp.reemplazar_catalogo(cat.getvalue())
                except ValueError as exc:
                    st.error(str(exc))
                else:
                    st.session_state["erp_resultado"] = ("catalogo", {})
                    st.session_state.pop("catalogo", None)
                    st.rerun()


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------


def pantalla_usuarios(usuario) -> None:
    ui.encabezado("Usuarios", "Crea vendedores, restablece contraseñas y desactiva accesos.")

    entregar = st.session_state.pop("usr_clave", None)
    if entregar:
        with ui.tarjeta():
            ui.aviso(
                "ok", f"Contraseña temporal de {entregar['nombre']}",
                "Entrégala en privado. Al entrar, el sistema le pedirá crear una propia. "
                "No se volverá a mostrar.",
            )
            st.code(entregar["clave"], language=None)
    flash = st.session_state.pop("usr_flash", None)
    if flash:
        ui.aviso(*flash)

    lista = usuarios.listar_usuarios()
    tabla = pd.DataFrame([
        {
            "Nombre": u["nombre"],
            "Rol": "Gerente" if u["rol"] == ROL_GERENTE else "Vendedor",
            "Acceso": "Activo" if u["activo"] else "Desactivado",
            "Contraseña": "Temporal (pendiente de cambio)" if u["debe_cambiar"] else "Personal",
            "Último ingreso": (u["ultimo_ingreso"] or "—").replace("T", " ")[:16],
            "Nombre en ERP": u.get("nombre_erp") or "—",
        }
        for u in lista
    ])
    st.dataframe(tabla, hide_index=True, use_container_width=True)

    c1, c2 = st.columns(2, gap="large")
    with c1:
        with ui.tarjeta():
            ui.titulo_seccion("Agregar vendedor")
            with st.form("usr_nuevo", border=False, clear_on_submit=True):
                nombre = st.text_input("Nombre completo")
                crear = st.form_submit_button("Crear vendedor", type="primary")
            if crear:
                try:
                    clave = usuarios.crear_vendedor(nombre)
                except ValueError as e:
                    st.error(str(e))
                else:
                    st.session_state["usr_clave"] = {"nombre": " ".join(nombre.split()), "clave": clave}
                    st.rerun()
    with c2:
        with ui.tarjeta():
            ui.titulo_seccion("Gestionar acceso")
            por_nombre = {u["nombre"]: u for u in lista}
            elegido = st.selectbox("Usuario", list(por_nombre), index=None, placeholder="Elige un usuario",
                                   key="usr_sel")
            if elegido:
                u = por_nombre[elegido]
                a, b = st.columns(2)
                if a.button("Restablecer contraseña", use_container_width=True, key="usr_reset"):
                    st.session_state["usr_clave"] = {
                        "nombre": elegido, "clave": usuarios.restablecer_password(elegido),
                    }
                    st.rerun()
                es_yo = elegido == usuario.nombre
                if u["activo"]:
                    if b.button("Desactivar acceso", use_container_width=True, key="usr_off", disabled=es_yo,
                                help="No puedes desactivar tu propia cuenta." if es_yo else None):
                        try:
                            usuarios.establecer_activo(elegido, False)
                        except ValueError as e:
                            st.error(str(e))
                        else:
                            st.session_state["usr_flash"] = ("info", f"Acceso de {elegido} desactivado", "")
                            st.rerun()
                elif b.button("Reactivar acceso", use_container_width=True, key="usr_on"):
                    usuarios.establecer_activo(elegido, True)
                    st.session_state["usr_flash"] = ("ok", f"Acceso de {elegido} reactivado", "")
                    st.rerun()

                with st.form(f"usr_renombrar_{elegido}", border=False):
                    nuevo_nombre = st.text_input("Cambiar nombre", value=elegido,
                                                 help="Nombre y primer apellido, como aparece en la app y en el PDF.")
                    renombrar = st.form_submit_button("Guardar nombre")
                if renombrar and " ".join(nuevo_nombre.split()) != elegido:
                    try:
                        usuarios.renombrar(elegido, nuevo_nombre)
                    except ValueError as e:
                        st.error(str(e))
                    else:
                        st.session_state["usr_flash"] = ("ok", f"{elegido} ahora se llama {' '.join(nuevo_nombre.split())}", "")
                        st.rerun()

                if not es_yo and u["rol"] != ROL_GERENTE:
                    if usuarios.tiene_historial(elegido):
                        st.caption("Tiene cotizaciones registradas: no se puede eliminar, solo desactivar.")
                    else:
                        confirmar = st.checkbox(f"Confirmo que quiero eliminar a {elegido}", key=f"usr_conf_{elegido}")
                        if st.button("Eliminar usuario", disabled=not confirmar, key=f"usr_del_{elegido}"):
                            usuarios.eliminar(elegido, quien=usuario.nombre)
                            st.session_state.pop("usr_sel", None)
                            st.session_state["usr_flash"] = ("info", f"{elegido} eliminado", "")
                            st.rerun()
