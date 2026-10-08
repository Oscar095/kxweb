"""Ingreso, cambio de contraseña y 'Mi cuenta'."""
from __future__ import annotations

from typing import Callable

import streamlit as st

from .. import ui, usuarios
from ..config import ROL_GERENTE


def _marca_central(titulo: str, texto: str) -> None:
    st.markdown(
        f"<div class='kos-login-marca'><div class='kos-logo'>K</div>"
        f"<b>{ui.esc(titulo)}</b><span>{ui.esc(texto)}</span></div>",
        unsafe_allow_html=True,
    )


def pantalla_login() -> None:
    """Formulario de ingreso. Si es correcto deja el usuario en la sesion y recarga."""
    _, centro, _ = st.columns([1, 1.1, 1])
    with centro:
        _marca_central("Cotizador Kos", "Ingresa con tu usuario y contraseña")
        mensaje = st.session_state.pop("login_msg", None)
        if mensaje:
            ui.aviso("info", mensaje)
        nombres = [u["nombre"] for u in usuarios.listar_usuarios(solo_activos=True)]
        with ui.tarjeta():
            with st.form("login", border=False):
                nombre = st.selectbox("Usuario", nombres, index=None, placeholder="Elige tu nombre")
                clave = st.text_input("Contraseña", type="password")
                entrar = st.form_submit_button("Ingresar", type="primary", use_container_width=True)
            if entrar:
                if not nombre or not clave:
                    st.error("Escribe tu usuario y tu contraseña.")
                else:
                    resultado = usuarios.autenticar(nombre, clave)
                    if resultado.usuario is None:
                        st.error(resultado.error)
                    else:
                        st.session_state.clear()
                        st.session_state["usuario"] = resultado.usuario
                        st.session_state["debe_cambiar"] = resultado.debe_cambiar
                        st.rerun()
        st.caption("¿Olvidaste tu contraseña? Pídele al gerente que la restablezca.")


def _form_nueva_clave(key: str, nombre: str, pedir_actual: bool, boton: str) -> bool:
    """Formulario de cambio de clave. Devuelve True si se cambio."""
    with st.form(key, border=False, clear_on_submit=False):
        actual = st.text_input("Contraseña actual", type="password") if pedir_actual else None
        nueva = st.text_input(
            "Nueva contraseña", type="password",
            help=f"Mínimo {usuarios.MIN_LONGITUD} caracteres, con letras y números.",
        )
        confirmar = st.text_input("Repite la nueva contraseña", type="password")
        enviar = st.form_submit_button(boton, type="primary", use_container_width=True)
    if not enviar:
        return False
    if nueva != confirmar:
        st.error("Las contraseñas no coinciden.")
        return False
    try:
        usuarios.cambiar_password(nombre, nueva, actual=actual)
    except ValueError as e:
        st.error(str(e))
        return False
    return True


def pantalla_cambio_obligatorio(usuario, on_salir: Callable[[], None]) -> None:
    """Primer ingreso o clave restablecida: crear contraseña propia antes de seguir."""
    _, centro, _ = st.columns([1, 1.1, 1])
    with centro:
        primer_nombre = usuario.nombre.split()[0]
        _marca_central(
            f"Hola, {primer_nombre}",
            "Por seguridad, cambia la contraseña temporal por una personal.",
        )
        with ui.tarjeta():
            if _form_nueva_clave("cambio_obligatorio", usuario.nombre, False, "Guardar y entrar"):
                st.session_state["debe_cambiar"] = False
                st.rerun()
        if st.button("Salir", use_container_width=True, key="cambio_salir"):
            on_salir()


def pantalla_mi_cuenta(usuario) -> None:
    rol = "Gerente" if usuario.rol == ROL_GERENTE else "Vendedor"
    ui.encabezado("Mi cuenta", f"{usuario.nombre} · {rol}")
    flash = st.session_state.pop("cuenta_flash", None)
    if flash:
        ui.aviso("ok", flash)
    col_firma, col_clave = st.columns(2, gap="large")
    with col_firma:
        with ui.tarjeta():
            ui.titulo_seccion("Tu firma en las cotizaciones")
            st.caption("Así aparece tu nombre al final de la carta de oferta.")
            datos = usuarios.perfil(usuario.nombre)
            with st.form("mi_cuenta_firma", border=False):
                cargo = st.text_input("Cargo", value=datos["cargo"], placeholder="Ejecutivo(a) Comercial")
                celular = st.text_input("Celular", value=datos["celular"], placeholder="+(57) 300 000 00 00")
                correo = st.text_input("Correo", value=datos["correo"], placeholder="nombre@koscolombia.com")
                guardar = st.form_submit_button("Guardar firma", type="primary", use_container_width=True)
            if guardar:
                try:
                    usuarios.actualizar_perfil(usuario.nombre, cargo=cargo, celular=celular, correo=correo)
                except ValueError as e:
                    st.error(str(e))
                else:
                    st.session_state["cuenta_flash"] = "Firma actualizada. Se usará en los próximos PDF."
                    st.rerun()
    with col_clave:
        with ui.tarjeta():
            ui.titulo_seccion("Cambiar contraseña")
            if _form_nueva_clave("mi_cuenta_clave", usuario.nombre, True, "Cambiar contraseña"):
                st.session_state["cuenta_flash"] = "Contraseña actualizada."
                st.rerun()
