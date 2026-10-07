"""Panel de KPIs.

Visibilidad:
    - Gerente: ve todo (costos, margen $, todos los vendedores, exporta CSV).
    - Vendedor: ve unicamente sus propias cotizaciones, SIN costos ni margen $.

Indicadores MVP:
    - Conteos por estado.
    - Win rate = ganadas / total cotizaciones del periodo.
    - UB% promedio (solo gerente).
    - Valor cotizado (gerente: completo; vendedor: solo de sus cotizaciones).
    - Margen $ (solo gerente).
    - Cotizaciones pendientes de aprobacion (gerente).
    - Tiempo promedio envio -> resultado (dias).
    - Tiempo promedio cotizacion -> primera retroalimentacion (dias).
    - Numero de perdidas + razones agrupadas (top + tabla).
    - Desglose por vendedor (solo gerente).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

import pandas as pd
import streamlit as st

from .. import database, ui
from ..config import (
    ESTADO_ENVIADA,
    ESTADO_GANADA,
    ESTADO_NEGOCIACION,
    ESTADO_PENDIENTE_APROBACION,
    ESTADO_PERDIDA,
    ROL_GERENTE,
    estado_label,
)
from ..formato import fmt_miles, fmt_moneda, fmt_porcentaje


# ---------------------------------------------------------------------------
# Carga del dataset
# ---------------------------------------------------------------------------


def _dataframe_completo(
    desde: str | None,
    hasta: str | None,
    vendedor: str | None = None,
    db_path=None,
) -> pd.DataFrame:
    dbp = db_path or database.DB_PATH
    cots = database.listar_cotizaciones(
        vendedor=vendedor, desde=desde, hasta=hasta, db_path=dbp
    )
    if not cots:
        return pd.DataFrame()
    rows = []
    for c in cots:
        lineas = database.listar_lineas(c["id"], db_path=dbp)
        n_items = len(lineas)
        venta_lineas = sum(
            (float(l["precio"] or 0) * float(l["cantidad_mes"] or 0)) for l in lineas
        )
        flete_adic = float(c.get("flete_adicional") or 0)
        venta = venta_lineas + flete_adic
        margen = sum(
            (
                float(l["precio"] or 0)
                - float(l["costo_unit"] or 0)
                - float(l["flete_unit"] or 0)
            )
            * float(l["cantidad_mes"] or 0)
            for l in lineas
        )
        ub_global = (margen / venta_lineas) if venta_lineas else None

        # Primera fecha de retroalimentacion (cualquier seguimiento posterior).
        seguimientos = database.listar_seguimientos(c["id"], db_path=dbp)
        primera_retro_fecha = None
        if seguimientos:
            # listar_seguimientos viene ORDER BY creado_en DESC, asi que el primero
            # cronologico es el ultimo de la lista.
            primera_retro_fecha = seguimientos[-1]["creado_en"]

        rows.append({
            **c,
            "venta": venta,
            "venta_lineas": venta_lineas,
            "flete_adicional": flete_adic,
            "n_items": n_items,
            "margen": margen,
            "ub_pct": ub_global,
            "primera_retro": primera_retro_fecha,
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Helpers de KPIs
# ---------------------------------------------------------------------------


def _dias_promedio_a_retro(df: pd.DataFrame) -> float | None:
    """Dias entre cot.fecha y el primer seguimiento (retroalimentacion)."""
    sub = df.dropna(subset=["primera_retro"]).copy()
    if sub.empty:
        return None
    sub["t_cot"] = pd.to_datetime(sub["fecha"], errors="coerce")
    sub["t_retro"] = pd.to_datetime(sub["primera_retro"], errors="coerce")
    sub["dias"] = (sub["t_retro"] - sub["t_cot"]).dt.total_seconds() / 86400.0
    sub = sub[sub["dias"].notna() & (sub["dias"] >= 0)]
    if sub.empty:
        return None
    return float(sub["dias"].mean())


def _razones_de_perdida(df: pd.DataFrame, db_path=None) -> pd.DataFrame:
    """Resumen agregado por razon de perdida (sin detalle de cliente)."""
    dbp = db_path or database.DB_PATH
    perdidas = df[df["estado"] == ESTADO_PERDIDA]
    if perdidas.empty:
        return pd.DataFrame(columns=["Razon", "Cantidad", "% del total perdidas"])
    motivos: list[str] = []
    for cid in perdidas["id"].tolist():
        seg = database.listar_seguimientos(int(cid), db_path=dbp)
        for s in seg:
            if s["estado"] == ESTADO_PERDIDA and (s.get("motivo") or "").strip():
                motivo_raw = s["motivo"].strip()
                clave = motivo_raw.split("|", 1)[0].strip()
                if clave.lower().startswith("otro"):
                    motivos.append("otro")
                else:
                    motivos.append(clave)
                break
    if not motivos:
        return pd.DataFrame(columns=["Razon", "Cantidad", "% del total perdidas"])
    serie = pd.Series(motivos, name="Razon").value_counts()
    total = int(serie.sum())
    out = serie.reset_index()
    out.columns = ["Razon", "Cantidad"]
    out["Razon"] = out["Razon"].astype(str).str.replace("_", " ").str.capitalize()
    out["% del total perdidas"] = (out["Cantidad"] / total * 100).round(1).astype(str) + "%"
    return out


def _clientes_ganados(df: pd.DataFrame) -> pd.DataFrame:
    """Resumen por cliente: cotizaciones ganadas y valor total ganado."""
    ganadas = df[df["estado"] == ESTADO_GANADA]
    if ganadas.empty:
        return pd.DataFrame(columns=["Cliente", "Cotizaciones ganadas", "Valor ganado (COP)"])
    agg = ganadas.groupby("cliente_nombre").agg(
        ganadas=("id", "count"),
        valor=("venta", "sum"),
    ).reset_index()
    agg = agg.sort_values("valor", ascending=False)
    out = pd.DataFrame({
        "Cliente": agg["cliente_nombre"],
        "Cotizaciones ganadas": agg["ganadas"].astype(int),
        "Valor ganado (COP)": agg["valor"].apply(lambda v: fmt_moneda(v, 0)),
    })
    return out


def _detalle_ganadas(df: pd.DataFrame, db_path=None) -> pd.DataFrame:
    """Detalle por cotizacion ganada: codigo, cliente, valor, vendedor, fecha cierre."""
    dbp = db_path or database.DB_PATH
    ganadas = df[df["estado"] == ESTADO_GANADA].copy()
    if ganadas.empty:
        return pd.DataFrame(columns=["Codigo", "Cliente", "Vendedor",
                                     "Valor (COP)", "Tipo cliente", "Fecha cierre"])
    filas = []
    for _, r in ganadas.iterrows():
        seg = database.listar_seguimientos(int(r["id"]), db_path=dbp)
        fecha_cierre = ""
        for s in seg:
            if s["estado"] == ESTADO_GANADA:
                fecha_cierre = (s.get("fecha_cierre") or s.get("creado_en") or "")[:10]
                break
        tipo = "Nuevo" if int(r.get("cliente_es_nuevo") or 0) == 1 else "Existente"
        filas.append({
            "Codigo": r["codigo"],
            "Cliente": r.get("cliente_nombre", ""),
            "Vendedor": r.get("vendedor", ""),
            "Valor (COP)": fmt_moneda(float(r.get("venta") or 0), 0),
            "Tipo cliente": tipo,
            "Fecha cierre": fecha_cierre,
        })
    return pd.DataFrame(filas)


def _detalle_perdidas(df: pd.DataFrame, db_path=None) -> pd.DataFrame:
    """Detalle por cotizacion perdida: cliente, razon, valor y fecha de cierre."""
    dbp = db_path or database.DB_PATH
    perdidas = df[df["estado"] == ESTADO_PERDIDA].copy()
    if perdidas.empty:
        return pd.DataFrame(columns=["Codigo", "Cliente", "Razon", "Detalle",
                                     "Valor (COP)", "Vendedor", "Fecha cierre"])
    filas = []
    for _, r in perdidas.iterrows():
        seg = database.listar_seguimientos(int(r["id"]), db_path=dbp)
        motivo_raw = ""
        fecha_cierre = ""
        for s in seg:
            if s["estado"] == ESTADO_PERDIDA:
                motivo_raw = (s.get("motivo") or "").strip()
                fecha_cierre = (s.get("fecha_cierre") or s.get("creado_en") or "")[:10]
                break
        # Separar razon principal de detalle (formato "razon | notas" o "otro: texto")
        clave = motivo_raw.split("|", 1)[0].strip() if motivo_raw else ""
        detalle = motivo_raw.split("|", 1)[1].strip() if "|" in motivo_raw else ""
        if clave.lower().startswith("otro:"):
            detalle = (clave[5:].strip() + (" | " + detalle if detalle else "")).strip(" |")
            clave = "otro"
        elif clave.lower() == "otro":
            pass
        razon_lbl = clave.replace("_", " ").capitalize() if clave else "(sin razon)"
        filas.append({
            "Codigo": r["codigo"],
            "Cliente": r.get("cliente_nombre", ""),
            "Razon": razon_lbl,
            "Detalle": detalle,
            "Valor (COP)": fmt_moneda(float(r.get("venta") or 0), 0),
            "Vendedor": r.get("vendedor", ""),
            "Fecha cierre": fecha_cierre,
        })
    return pd.DataFrame(filas)


# ---------------------------------------------------------------------------
# Pantalla
# ---------------------------------------------------------------------------


def pantalla_kpis(usuario) -> None:
    es_gerente = usuario.rol == ROL_GERENTE

    if es_gerente:
        ui.encabezado("KPIs", "Resumen gerencial de todo el equipo.")
        vendedor_filtro = None
    else:
        ui.encabezado("Mis KPIs", "Indicadores de tus cotizaciones.")
        vendedor_filtro = usuario.nombre

    col1, col2 = st.columns(2)
    hoy = date.today()
    desde = col1.date_input("Desde", value=hoy - timedelta(days=90), key="kpi_desde")
    hasta = col2.date_input("Hasta", value=hoy, key="kpi_hasta")

    df = _dataframe_completo(
        desde.isoformat() if desde else None,
        (hasta + timedelta(days=1)).isoformat() if hasta else None,  # inclusivo
        vendedor=vendedor_filtro,
    )

    if df.empty:
        st.info("No hay cotizaciones en el rango.")
        return

    # --- Conteos por estado --------------------------------------------------
    total = len(df)
    enviadas = int((df["estado"] == ESTADO_ENVIADA).sum())
    ganadas = int((df["estado"] == ESTADO_GANADA).sum())
    perdidas = int((df["estado"] == ESTADO_PERDIDA).sum())
    negociacion = int((df["estado"] == ESTADO_NEGOCIACION).sum())
    pendientes_aprob = int((df["estado"] == ESTADO_PENDIENTE_APROBACION).sum())

    # --- Conteos y valor por tipo de cliente -------------------------------
    serie_tipo = df.get("cliente_es_nuevo", pd.Series([0] * total)).fillna(0).astype(int)
    mask_nuevos = serie_tipo == 1
    mask_existentes = serie_tipo == 0
    cots_nuevos = int(mask_nuevos.sum())
    cots_existentes = int(mask_existentes.sum())
    valor_nuevos = float(df.loc[mask_nuevos, "venta"].sum()) if cots_nuevos else 0.0
    valor_existentes = float(df.loc[mask_existentes, "venta"].sum()) if cots_existentes else 0.0

    # --- Win rate (ganadas / total cotizaciones) ----------------------------
    win_rate = ganadas / total if total else 0.0

    # --- Agregados monetarios -----------------------------------------------
    venta_total = float(df["venta"].sum())
    margen_total = float(df["margen"].sum())
    ub_promedio = (
        float(df["ub_pct"].dropna().mean()) if df["ub_pct"].notna().any() else 0.0
    )
    valor_ganado = float(df[df["estado"] == ESTADO_GANADA]["venta"].sum())
    valor_perdido = float(df[df["estado"] == ESTADO_PERDIDA]["venta"].sum())

    # --- Layout principal ---------------------------------------------------
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Cotizaciones", total)
    c2.metric("Enviadas", enviadas)
    c3.metric("Ganadas", ganadas, delta=fmt_moneda(valor_ganado, 0), delta_color="off")
    c4.metric("Perdidas", perdidas, delta=fmt_moneda(valor_perdido, 0), delta_color="off")

    c5, c6, c7, c8 = st.columns(4)
    c5.metric("En negociacion", negociacion)
    if es_gerente:
        c6.metric("Pendientes aprobacion", pendientes_aprob)
    else:
        c6.metric("Mis pendientes", pendientes_aprob)
    c7.metric("Win rate (ganadas / total)", fmt_porcentaje(win_rate, 1))
    if es_gerente:
        c8.metric("UB% promedio", fmt_porcentaje(ub_promedio, 2))
    else:
        c8.empty()

    c9, c10, c11, c12 = st.columns(4)
    c9.metric("Valor cotizado", fmt_moneda(venta_total, 0))
    c10.metric("Valor ganado", fmt_moneda(valor_ganado, 0))
    c11.metric("Valor perdido", fmt_moneda(valor_perdido, 0))
    if es_gerente:
        c12.metric("Margen $", fmt_moneda(margen_total, 0))
    else:
        c12.empty()

    c13, c14, c15, c16 = st.columns(4)
    c13.metric(
        "Cotizaciones a clientes Nuevos", cots_nuevos,
        delta=fmt_moneda(valor_nuevos, 0), delta_color="off",
    )
    c14.metric(
        "Cotizaciones a clientes Existentes", cots_existentes,
        delta=fmt_moneda(valor_existentes, 0), delta_color="off",
    )
    c15.empty()
    c16.empty()

    st.divider()

    # --- Tiempos -------------------------------------------------------------
    ui.titulo_seccion("Tiempos del ciclo")
    col_t1, col_t2 = st.columns(2)
    df["fecha_dt"] = pd.to_datetime(df["fecha"], errors="coerce")
    df["upd_dt"] = pd.to_datetime(df["actualizado_en"], errors="coerce")
    finales = df[df["estado"].isin([ESTADO_GANADA, ESTADO_PERDIDA])].copy()
    if not finales.empty:
        finales["dias"] = (finales["upd_dt"] - finales["fecha_dt"]).dt.total_seconds() / 86400.0
        promedio_dias = float(finales["dias"].mean())
        col_t1.metric("Dias promedio (envio -> cierre)", f"{promedio_dias:.1f}")
    else:
        col_t1.metric("Dias promedio (envio -> cierre)", "N/A")

    dias_retro = _dias_promedio_a_retro(df)
    if dias_retro is not None:
        col_t2.metric("Dias promedio (cotizacion -> retroalimentacion)", f"{dias_retro:.1f}")
    else:
        col_t2.metric("Dias promedio (cotizacion -> retroalimentacion)", "N/A")

    st.divider()

    # --- Panel de ganadas ----------------------------------------------------
    ui.titulo_seccion("Ganadas")
    col_g1, col_g2 = st.columns([1, 3])
    col_g1.metric("Total ganadas", ganadas)
    col_g1.metric("Valor ganado", fmt_moneda(valor_ganado, 0))

    cli_ganados_df = _clientes_ganados(df)
    if cli_ganados_df.empty:
        col_g2.caption("Aun no hay cotizaciones ganadas en el rango.")
    else:
        with col_g2:
            st.markdown("**Clientes ganados (agregado)**")
            st.dataframe(cli_ganados_df, use_container_width=True, hide_index=True)

    # Detalle gerencial: cotizaciones ganadas con monto, cliente y vendedor.
    if es_gerente:
        detalle_g = _detalle_ganadas(df)
        if not detalle_g.empty:
            st.markdown("**Detalle de cotizaciones ganadas**")
            st.dataframe(detalle_g, use_container_width=True, hide_index=True)

    st.divider()

    # --- Panel de perdidas ---------------------------------------------------
    ui.titulo_seccion("Perdidas y razones")
    col_p1, col_p2 = st.columns([1, 3])
    col_p1.metric("Total perdidas", perdidas)
    razones_df = _razones_de_perdida(df)
    if razones_df.empty:
        col_p2.caption("Aun no hay cotizaciones perdidas con razon registrada en el rango.")
    else:
        with col_p2:
            st.dataframe(razones_df, use_container_width=True, hide_index=True)

    # Detalle por cotizacion perdida (incluye cliente)
    detalle_df = _detalle_perdidas(df)
    if not detalle_df.empty:
        st.markdown("**Detalle por cliente perdido**")
        st.dataframe(detalle_df, use_container_width=True, hide_index=True)

    # --- Desglose por vendedor (solo gerente) -------------------------------
    if es_gerente:
        st.divider()
        ui.titulo_seccion("Por vendedor")
        by_v = df.groupby("vendedor").agg(
            cotizaciones=("id", "count"),
            ganadas=("estado", lambda s: int((s == ESTADO_GANADA).sum())),
            perdidas=("estado", lambda s: int((s == ESTADO_PERDIDA).sum())),
            venta=("venta", "sum"),
            margen=("margen", "sum"),
            ub_pct=("ub_pct", "mean"),
        ).reset_index()
        by_v["win_rate"] = by_v.apply(
            lambda r: r["ganadas"] / r["cotizaciones"] if r["cotizaciones"] else 0.0,
            axis=1,
        )
        by_v["UB% promedio"] = by_v["ub_pct"].apply(lambda v: fmt_porcentaje(v, 2))
        by_v["Win rate"] = by_v["win_rate"].apply(lambda v: fmt_porcentaje(v, 1))
        by_v["Venta"] = by_v["venta"].apply(lambda v: fmt_moneda(v, 0))
        by_v["Margen $"] = by_v["margen"].apply(lambda v: fmt_moneda(v, 0))
        st.dataframe(
            by_v[["vendedor", "cotizaciones", "ganadas", "perdidas",
                  "Win rate", "UB% promedio", "Venta", "Margen $"]]
            .rename(columns={
                "vendedor": "Vendedor", "cotizaciones": "Cotizaciones",
                "ganadas": "Ganadas", "perdidas": "Perdidas",
            }),
            use_container_width=True,
            hide_index=True,
        )

    # --- Embudo --------------------------------------------------------------
    st.divider()
    ui.titulo_seccion("Embudo")
    agg_embudo = df.groupby("estado").agg(
        conteo=("id", "count"),
        valor=("venta", "sum"),
    )
    agg_embudo = agg_embudo.sort_values("conteo", ascending=False)
    valor_global = float(agg_embudo["valor"].sum())
    agg_embudo["%"] = (agg_embudo["conteo"] / total * 100).round(1).astype(str) + "%"
    agg_embudo["Valor (COP)"] = agg_embudo["valor"].apply(lambda v: fmt_moneda(v, 0))
    agg_embudo = agg_embudo[["conteo", "%", "Valor (COP)"]]
    agg_embudo.columns = ["Conteo", "% del total", "Valor (COP)"]

    total_row = pd.DataFrame(
        {
            "Conteo": [int(agg_embudo["Conteo"].sum())],
            "% del total": ["100,0%"],
            "Valor (COP)": [fmt_moneda(valor_global, 0)],
        },
        index=["TOTAL"],
    )
    agg_embudo.index = [estado_label(e) for e in agg_embudo.index]
    embudo_tot = pd.concat([agg_embudo, total_row])
    embudo_tot.index.name = "Estado"
    st.dataframe(embudo_tot, use_container_width=True)

    # --- Cotizaciones del rango (con valor y # items) ----------------------
    st.divider()
    ui.titulo_seccion("Cotizaciones del rango")
    df_tab = df.copy()
    df_tab["valor_fmt"] = df_tab["venta"].apply(lambda v: fmt_moneda(v, 0))
    df_tab["tipo_cli"] = df_tab.get("cliente_es_nuevo", 0).fillna(0).astype(int).apply(
        lambda v: "Nuevo" if v == 1 else "Existente"
    )
    cols_tab = ["codigo", "fecha", "vendedor", "cliente_nombre", "tipo_cli",
                "estado", "n_items", "valor_fmt"]
    vista_tab = df_tab[cols_tab].rename(columns={
        "codigo": "Código", "fecha": "Fecha", "vendedor": "Vendedor",
        "cliente_nombre": "Cliente", "tipo_cli": "Tipo cliente",
        "estado": "Estado", "n_items": "Ítems", "valor_fmt": "Valor (COP)",
    })
    vista_tab["Fecha"] = vista_tab["Fecha"].str[:10]
    vista_tab["Estado"] = vista_tab["Estado"].map(estado_label)
    st.dataframe(ui.estilizar(vista_tab, col_estado="Estado"), use_container_width=True, hide_index=True)

    # --- Categorias de feedback ---------------------------------------------
    cats: list[str] = []
    for _, row in df.iterrows():
        for s in database.listar_seguimientos(int(row["id"]), db_path=database.DB_PATH):
            if s.get("categoria_feedback"):
                cats.append(s["categoria_feedback"])
    if cats:
        ui.titulo_seccion("Categorias de feedback")
        st.write(pd.Series(cats, name="categoria").value_counts())

    # --- Export (solo gerente) ----------------------------------------------
    if es_gerente:
        st.divider()
        cols_export = ["codigo", "fecha", "vendedor", "cliente_nombre",
                       "estado", "venta", "margen", "ub_pct"]
        if st.download_button(
            "Exportar resumen (CSV)",
            data=df[cols_export].to_csv(index=False).encode("utf-8"),
            file_name="kpis_resumen.csv",
            mime="text/csv",
        ):
            pass
