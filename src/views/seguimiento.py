"""Seguimiento post-envio + retroalimentacion del cliente.

Reglas:
    - Si el resultado es 'perdida', el motivo debe seleccionarse del catalogo
      MOTIVOS_PERDIDA. Si se elige 'otro', se exige especificacion en texto libre.
    - Para los demas estados (enviada / negociacion / ganada), el motivo es opcional.
"""
from __future__ import annotations

from datetime import date

import pandas as pd
import streamlit as st

from .. import database, ui
from ..config import (
    CATEGORIAS_FEEDBACK,
    ESTADO_ENVIADA,
    ESTADO_GANADA,
    ESTADO_NEGOCIACION,
    ESTADO_PERDIDA,
    MOTIVOS_PERDIDA,
    MOTIVO_PERDIDA_OTRO,
    ROL_GERENTE,
    estado_label,
)
from ..formato import fmt_moneda


def pantalla_seguimiento(usuario) -> None:
    ui.encabezado("Seguimiento", "Registra la respuesta del cliente: en negociación, ganada o perdida.")
    flash = st.session_state.pop("seg_flash", None)
    if flash:
        ui.aviso("ok", flash)

    filtro_vendedor = None if usuario.rol == ROL_GERENTE else usuario.nombre
    cots = database.listar_cotizaciones_con_totales(vendedor=filtro_vendedor)
    if not cots:
        ui.vacio("Todavía no hay cotizaciones para hacer seguimiento.")
        return

    df = pd.DataFrame(cots)
    estados = ["(todos)", ESTADO_ENVIADA, ESTADO_NEGOCIACION, ESTADO_GANADA, ESTADO_PERDIDA]
    col1, col2 = st.columns(2)
    f_estado = col1.selectbox(
        "Estado", estados, index=0,
        format_func=lambda e: "Todos los estados" if e == "(todos)" else estado_label(e),
    )
    f_cliente = col2.text_input("Cliente", "", placeholder="Buscar por nombre")

    if f_estado != "(todos)":
        df = df[df["estado"] == f_estado]
    if f_cliente:
        df = df[df["cliente_nombre"].str.contains(f_cliente, case=False, na=False)]

    if df.empty:
        ui.vacio("No hay cotizaciones con ese filtro.")
        return

    df = df.copy()
    vista = pd.DataFrame({
        "Código": df["codigo"],
        "Fecha": df["fecha"].str[:10],
        "Vendedor": df["vendedor"],
        "Cliente": df["cliente_nombre"],
        "Estado": df["estado"].map(estado_label),
        "Ítems": df["n_items"].astype(int),
        "Valor": df["valor_total"].apply(lambda v: fmt_moneda(v, 0)),
        "Actualizado": df["actualizado_en"].fillna("").str[:16].str.replace("T", " "),
    })
    st.dataframe(ui.estilizar(vista, col_estado="Estado"), use_container_width=True, hide_index=True)

    codigos = df["codigo"].tolist()
    c_sel, c_ver = st.columns([3, 1], vertical_alignment="bottom")
    sel = c_sel.selectbox("Cotización a actualizar", codigos)
    cot = next(c for c in cots if c["codigo"] == sel)
    if c_ver.button("Ver cotización", use_container_width=True, key="seg_ver"):
        st.session_state["mc_ver"] = int(cot["id"])
        st.session_state["pagina"] = "cotizaciones" if usuario.rol == ROL_GERENTE else "mis"
        st.rerun()

    ui.titulo_seccion(f"Actualizar {sel} · {cot['cliente_nombre']}")
    estado_nuevo = st.radio(
        "Resultado",
        [ESTADO_ENVIADA, ESTADO_NEGOCIACION, ESTADO_GANADA, ESTADO_PERDIDA],
        index=[ESTADO_ENVIADA, ESTADO_NEGOCIACION, ESTADO_GANADA, ESTADO_PERDIDA].index(cot["estado"])
        if cot["estado"] in (ESTADO_ENVIADA, ESTADO_NEGOCIACION, ESTADO_GANADA, ESTADO_PERDIDA) else 0,
        horizontal=True,
        format_func=estado_label,
    )

    # --- Motivo / categoria segun estado ---------------------------------
    motivo_perdida_otro_txt = ""
    if estado_nuevo == ESTADO_PERDIDA:
        st.markdown(
            "**Razon de la perdida** (obligatoria). Selecciona del catalogo. "
            "Si la causa no esta listada, elige 'otro' y especifica."
        )
        motivo_sel = st.selectbox(
            "Razon de la perdida*",
            MOTIVOS_PERDIDA,
            format_func=lambda x: x.replace("_", " ").capitalize(),
            key="seg_motivo_perdida",
        )
        if motivo_sel == MOTIVO_PERDIDA_OTRO:
            motivo_perdida_otro_txt = st.text_input(
                "Especifique la razon*", key="seg_motivo_otro_txt",
            )
        motivo_libre = st.text_area(
            "Notas adicionales (opcional)", "", height=80, key="seg_notas_perdida",
        )
    else:
        motivo_sel = None
        motivo_libre = st.text_input("Motivo (opcional)", "", key="seg_motivo_normal")

    cat = st.selectbox(
        "Categoria de retroalimentacion (opcional)",
        ["(ninguna)"] + list(CATEGORIAS_FEEDBACK),
        key="seg_cat",
    )
    feedback = st.text_area("Retroalimentacion del cliente", "", height=120, key="seg_feedback")
    fcierre = st.date_input("Fecha de cierre / actualizacion", value=date.today(), key="seg_fecha")

    if st.button("Guardar seguimiento", type="primary"):
        # Validar motivo obligatorio cuando es perdida
        if estado_nuevo == ESTADO_PERDIDA:
            if not motivo_sel:
                st.error("Seleccione la razon de la perdida.")
                return
            if motivo_sel == MOTIVO_PERDIDA_OTRO and not motivo_perdida_otro_txt.strip():
                st.error("Especifique la razon de perdida cuando elige 'otro'.")
                return
            # Componer motivo final
            if motivo_sel == MOTIVO_PERDIDA_OTRO:
                motivo_final = f"otro: {motivo_perdida_otro_txt.strip()}"
            else:
                motivo_final = motivo_sel
            if motivo_libre.strip():
                motivo_final = f"{motivo_final} | {motivo_libre.strip()}"
        else:
            motivo_final = motivo_libre

        database.registrar_seguimiento(
            cot["id"],
            estado=estado_nuevo,
            motivo=motivo_final,
            categoria_feedback="" if cat == "(ninguna)" else cat,
            feedback_cliente=feedback,
            fecha_cierre=fcierre.isoformat(),
            creado_por=usuario.nombre,
        )
        st.session_state["seg_flash"] = f"Seguimiento de {sel} guardado: {estado_label(estado_nuevo)}."
        st.rerun()

    historial = database.listar_seguimientos(cot["id"])
    if historial:
        ui.titulo_seccion("Historial")
        hist_df = pd.DataFrame(historial)[[
            "creado_en", "estado", "categoria_feedback", "motivo", "feedback_cliente", "creado_por"
        ]]
        hist_df.columns = ["Cuándo", "Estado", "Categoría", "Motivo", "Retroalimentación", "Por"]
        hist_df["Cuándo"] = hist_df["Cuándo"].str[:16].str.replace("T", " ")
        hist_df["Estado"] = hist_df["Estado"].map(estado_label)
        st.dataframe(ui.estilizar(hist_df, col_estado="Estado"), use_container_width=True, hide_index=True)
