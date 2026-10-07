"""Punto de entrada Streamlit del cotizador comercial Kos.

Ejecucion:
    streamlit run app.py

Cada persona entra con su usuario y contraseña. El rol (vendedor/gerente) sale de
la base de datos y define que pantallas y datos ve.
"""
from __future__ import annotations

import streamlit as st

from src import database, ui, usuarios
from src.auth import es_gerente
from src.config import ESTADO_PENDIENTE_APROBACION
from src.views import cuenta as v_cuenta
from src.views import gerente as v_gerente
from src.views import kpis as v_kpis
from src.views import seguimiento as v_seg
from src.views import vendedor as v_vendedor
from src.views.erp import pendientes_correo_erp

st.set_page_config(
    page_title="Cotizador Kos",
    page_icon=":bar_chart:",
    layout="wide",
    initial_sidebar_state="expanded",
)

# (clave, etiqueta)
PAGINAS_VENDEDOR = (
    ("nueva", "Nueva cotización"),
    ("mis", "Mis cotizaciones"),
    ("seguimiento", "Seguimiento"),
    ("kpis", "KPIs"),
)
PAGINAS_GERENTE = (
    ("nueva", "Nueva cotización"),
    ("aprobaciones", "Aprobaciones"),
    ("cotizaciones", "Cotizaciones"),
    ("seguimiento", "Seguimiento"),
    ("kpis", "KPIs"),
    ("configuracion", "Configuración"),
    ("usuarios", "Usuarios"),
)


def _cerrar_sesion(mensaje: str | None = None) -> None:
    st.session_state.clear()
    if mensaje:
        st.session_state["login_msg"] = mensaje
    st.rerun()


def _contadores(usuario) -> dict[str, int]:
    if es_gerente(usuario):
        return {"aprobaciones": len(database.listar_cotizaciones(estado=ESTADO_PENDIENTE_APROBACION))}
    aprobadas = v_vendedor.contar_aprobadas(usuario)
    correos_erp = len(pendientes_correo_erp(usuario.nombre))
    return {"mis": aprobadas + correos_erp, "aprobadas": aprobadas, "correos_erp": correos_erp}


def _sidebar(usuario, contadores: dict[str, int]) -> str:
    paginas = PAGINAS_GERENTE if es_gerente(usuario) else PAGINAS_VENDEDOR
    validas = {p[0] for p in paginas} | {"cuenta"}
    actual = st.session_state.get("pagina")
    if actual not in validas:
        actual = paginas[0][0]
        st.session_state["pagina"] = actual

    with st.sidebar:
        ui.marca()
        st.write("")
        ui.tarjeta_usuario(usuario)
        ui.etiqueta_menu("Menú")
        for clave, etiqueta in paginas:
            n = contadores.get(clave)
            texto = etiqueta + (f"  ({n})" if n else "")
            if st.button(texto, key=f"nav_{clave}", use_container_width=True,
                         type="primary" if clave == actual else "secondary"):
                st.session_state["pagina"] = clave
                st.session_state.pop("mc_ver", None)  # el menu siempre lleva al listado
                st.rerun()
        st.divider()
        if st.button("Mi cuenta", key="nav_cuenta", use_container_width=True,
                     type="primary" if actual == "cuenta" else "secondary"):
            st.session_state["pagina"] = "cuenta"
            st.rerun()
        if st.button("Cerrar sesión", key="nav_salir", use_container_width=True):
            _cerrar_sesion()
    return actual


def _aviso_aprobadas(n: int, correos_erp: int = 0) -> None:
    """Vendedor: aviso visible en todas las pantallas cuando hay PDFs listos o correos al ERP pendientes."""
    if n:
        texto = (
            "Tienes 1 cotización aprobada lista para enviar"
            if n == 1 else f"Tienes {n} cotizaciones aprobadas listas para enviar"
        )
        c1, c2 = st.columns([4, 1.2], vertical_alignment="center")
        with c1:
            ui.aviso("ok", texto, "El gerente ya las aprobó: descarga el PDF con un clic.")
        if c2.button("Ir a descargar", type="primary", use_container_width=True,
                     key="aviso_ir_descargar"):
            st.session_state["pagina"] = "mis"
            st.rerun()
    # En la pantalla de resultado del PDF el correo ya esta a la vista.
    if correos_erp and not st.session_state.get("nv_resultado"):
        texto = (
            "Tienes 1 correo al ERP pendiente"
            if correos_erp == 1 else f"Tienes {correos_erp} correos al ERP pendientes"
        )
        c1, c2 = st.columns([4, 1.2], vertical_alignment="center")
        with c1:
            ui.aviso("alerta", texto, "Ofertas enviadas al cliente cuyos precios falta reportar a quien los "
                                      "registra en el ERP. El correo ya está listo.")
        if c2.button("Ir a enviarlos", use_container_width=True, key="aviso_ir_erp"):
            st.session_state["pagina"] = "mis"
            st.rerun()


def main() -> None:
    ui.aplicar_estilos()
    database.inicializar()
    usuarios.asegurar_usuarios_iniciales()

    usuario = st.session_state.get("usuario")
    if usuario is None:
        v_cuenta.pantalla_login()
        return
    if not usuarios.esta_activo(usuario.nombre):
        _cerrar_sesion("Tu acceso fue desactivado. Habla con el gerente.")
        return
    if st.session_state.get("debe_cambiar"):
        v_cuenta.pantalla_cambio_obligatorio(usuario, on_salir=_cerrar_sesion)
        return

    contadores = _contadores(usuario)
    pagina = _sidebar(usuario, contadores)
    if not es_gerente(usuario) and pagina != "mis":
        _aviso_aprobadas(contadores.get("aprobadas", 0), contadores.get("correos_erp", 0))

    if pagina == "nueva":
        v_vendedor.pantalla_nueva_cotizacion(usuario)
    elif pagina in ("mis", "cotizaciones"):
        v_vendedor.pantalla_mis_cotizaciones(usuario)
    elif pagina == "seguimiento":
        v_seg.pantalla_seguimiento(usuario)
    elif pagina == "kpis":
        v_kpis.pantalla_kpis(usuario)
    elif pagina == "cuenta":
        v_cuenta.pantalla_mi_cuenta(usuario)
    elif es_gerente(usuario):
        if pagina == "aprobaciones":
            v_gerente.pantalla_aprobaciones(usuario)
        elif pagina == "configuracion":
            v_gerente.pantalla_configuracion(usuario)
        elif pagina == "usuarios":
            v_gerente.pantalla_usuarios(usuario)


if __name__ == "__main__":
    main()
