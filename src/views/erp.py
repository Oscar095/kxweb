"""Tarjeta con el correo para registrar en el ERP los precios de una cotizacion."""
from __future__ import annotations

import streamlit as st

from .. import correo_erp, database, ui, usuarios


def responsable_erp() -> dict:
    return {
        "nombre": database.obtener_parametro(correo_erp.PARAM_ERP_NOMBRE),
        "correo": database.obtener_parametro(correo_erp.PARAM_ERP_CORREO),
    }


def ultima_aprobacion(cot_id: int) -> dict | None:
    """Ultima decision 'aprobada' de la cotizacion, o None si nunca se aprobo."""
    for d in database.aprobaciones_de(int(cot_id)):
        if d["decision"] == "aprobada":
            return d
    return None


def origen_de(cot: dict, lineas: list[dict]) -> str | None:
    """Origen del visto bueno del precio de esta cotizacion (ver correo_erp.origen_precios)."""
    requiere = any((l.get("aprobacion_txt") or "").strip() for l in lineas)
    return correo_erp.origen_precios(
        cot["estado"], requiere, requiere and ultima_aprobacion(int(cot["id"])) is not None,
    )


def puede_ver_correo_erp(usuario, cot: dict, lineas: list[dict]) -> bool:
    """Con precio definido (aprobado por gerencia o dentro de la politica): el gerente,
    en todas; el ejecutivo comercial, en las suyas."""
    if origen_de(cot, lineas) is None:
        return False
    return usuario.rol == "gerente" or cot.get("vendedor") == usuario.nombre


def estado_correo_de(cot: dict, lineas: list[dict] | None = None) -> str:
    """'enviado', 'pendiente' o '' (ver correo_erp.estado_correo)."""
    if cot.get("erp_correo_en"):
        return correo_erp.CORREO_ENVIADO
    if cot.get("estado") not in correo_erp.ESTADOS_OFERTA_ENVIADA:
        return ""
    lineas = database.listar_lineas(int(cot["id"])) if lineas is None else lineas
    return correo_erp.estado_correo(cot["estado"], origen_de(cot, lineas), None)


def pendientes_correo_erp(vendedor: str | None = None) -> list[dict]:
    """Ofertas ya enviadas al cliente, con precio definido, cuyo correo al ERP falta."""
    return [c for c in database.listar_cotizaciones_con_totales(vendedor=vendedor)
            if estado_correo_de(c) == correo_erp.CORREO_PENDIENTE]


def texto_estado_correo(cot: dict) -> str:
    """Para tablas: 'Enviado 06-oct' / 'Pendiente' / '—'."""
    estado = estado_correo_de(cot)
    if estado == correo_erp.CORREO_ENVIADO:
        return f"Enviado {str(cot['erp_correo_en'])[:10]}"
    return "Pendiente" if estado == correo_erp.CORREO_PENDIENTE else "—"


def tarjeta_correo_erp(cot_id: int, usuario, key: str, al_cerrar=None) -> None:
    """Correo listo para enviar al responsable del ERP, con el cuadro de productos (precio,
    UB% y nivel de autorizacion). «Abrir correo listo» descarga un .eml que Outlook abre
    como borrador listo para Enviar; «Ya lo envié» deja la constancia."""
    cot = database.obtener_cotizacion(int(cot_id))
    if not cot:
        return
    cot["vendedor_erp"] = usuarios.perfil(cot["vendedor"]).get("nombre_erp", "")
    correo = correo_erp.armar_correo(
        cot, database.listar_lineas(int(cot_id)), ultima_aprobacion(cot_id),
        responsable_erp(), usuario.nombre, politica=database.obtener_politica(),
    )
    enviado = cot.get("erp_correo_en")
    with ui.tarjeta():
        ui.titulo_seccion(f"Correo para registrar los precios en el ERP · {cot['codigo']}")
        if enviado:
            ui.aviso("ok", "Correo al ERP enviado",
                     f"{cot.get('erp_correo_por') or ''} lo envió el {str(enviado)[:16].replace('T', ' ')}.")
        if not correo["para"]:
            ui.aviso(
                "alerta", "Falta el correo del responsable del ERP",
                "El gerente lo configura una vez en Configuración; mientras tanto escribe el destinatario "
                "en tu correo.",
            )
        st.caption(f"Para: {correo['para'] or '(sin configurar)'}  ·  Asunto: {correo['asunto']}")
        st.markdown(f"<div class='kos-correo'>{correo['html']}</div>", unsafe_allow_html=True)

        a, b, c = st.columns([1.5, 1.3, 1.2])
        a.download_button(
            "Abrir correo listo", correo_erp.correo_eml(correo),
            file_name=f"Correo ERP {cot['codigo']}.eml", mime="message/rfc822",
            type="primary", use_container_width=True, key=f"{key}_eml",
        )
        b.link_button("Correo sin formato", correo["mailto"], use_container_width=True)
        if not enviado:
            if c.button("Ya lo envié", use_container_width=True, key=f"{key}_enviado"):
                database.marcar_correo_erp(int(cot_id), usuario.nombre)
                if al_cerrar:
                    al_cerrar()
                st.rerun()
        elif al_cerrar and c.button("Cerrar", use_container_width=True, key=f"{key}_cerrar"):
            al_cerrar()
        texto = ("«Abrir correo listo» descarga el correo con el cuadro: ábrelo desde la descarga y Outlook lo "
                 "muestra con destinatario, asunto y cuadro, listo para darle Enviar (en Chrome o Edge puedes "
                 "elegir «Abrir siempre archivos de este tipo» para que se abra solo). Si tu Outlook no lo abre, "
                 "usa «Correo sin formato». Después marca «Ya lo envié» para dejar la constancia.")
        if len(correo["mailto"]) > 2000:  # limite practico de Outlook para enlaces mailto
            texto += " Con tantos productos, el «Correo sin formato» puede abrirse cortado."
        st.caption(texto)
        # Interruptor y no desplegable: esta tarjeta tambien se muestra dentro de un desplegable.
        if st.toggle("Ver el texto sin formato (para copiar)", key=f"{key}_ver_texto"):
            st.text_area("Texto del correo", correo["cuerpo"], height=240, key=f"{key}_cuerpo",
                         label_visibility="collapsed")
