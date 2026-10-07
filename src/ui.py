"""Estilos y piezas visuales compartidas.

Diseño sobrio y moderno: fondo gris muy claro, tarjetas blancas, un solo color
de marca (#0a3d62), letra legible (cuerpo 16 px) y estados con color.
Compatible con Streamlit 1.36.
"""
from __future__ import annotations

import html
from contextlib import contextmanager

import pandas as pd
import streamlit as st

from .config import ESTADO_LABEL, ROL_GERENTE

# (fondo, texto) por estado: pastillas y columna "Estado" de las tablas.
_COLOR_ESTADO = {
    "borrador": ("#eef1f5", "#3d4a5c"),
    "pendiente_aprobacion": ("#fff3d6", "#8a5a00"),
    "aprobada": ("#e2f0ff", "#0b5394"),
    "rechazada": ("#fde8e8", "#a61b1b"),
    "enviada": ("#e9ecff", "#3341a3"),
    "en_negociacion": ("#f2e9ff", "#6b2fb3"),
    "ganada": ("#e2f5e7", "#1d6b35"),
    "perdida": ("#f1f2f4", "#6b7280"),
}
_COLOR_POR_LABEL = {ESTADO_LABEL[k]: v for k, v in _COLOR_ESTADO.items()}

_COLOR_APROBACION = {
    "Requiere aprobacion comercial y financiera": ("#fde8e8", "#a61b1b"),
    "Requiere aprobacion comercial": ("#fff3d6", "#8a5a00"),
    "OK": ("#e2f5e7", "#1d6b35"),
    # Versiones cortas que muestran las tablas.
    "Comercial y financiera": ("#fde8e8", "#a61b1b"),
    "Comercial": ("#fff3d6", "#8a5a00"),
    "No": ("#e2f5e7", "#1d6b35"),
}

_CSS = """
<style>
:root{
  --kos-marca:#0a3d62; --kos-marca-suave:#e9f1f8; --kos-fondo:#f6f8fb;
  --kos-borde:#e4e8ef; --kos-texto:#1c2633; --kos-suave:#5d6b7c;
}
/* Adornos de Streamlit que no aportan */
[data-testid="stToolbar"]{visibility:hidden;}
[data-testid="stDecoration"]{display:none;}
footer{visibility:hidden;}
header[data-testid="stHeader"]{background:transparent;}

.stApp{background:var(--kos-fondo); color:var(--kos-texto);}
.block-container{padding:2.2rem 2.5rem 3rem; max-width:1240px;}
html, body{font-size:16px;}
.stMarkdown p, .stMarkdown li{font-size:15.5px; line-height:1.55;}
[data-testid="stCaptionContainer"]{color:var(--kos-suave) !important; font-size:13.5px !important;}

/* Campos */
[data-testid="stWidgetLabel"] p{font-size:14px !important; font-weight:600 !important; color:#334155 !important;}
.stTextInput input, .stNumberInput input, .stTextArea textarea, .stDateInput input{font-size:15px !important;}
div[data-baseweb="input"], div[data-baseweb="base-input"], div[data-baseweb="select"] > div,
div[data-baseweb="textarea"]{background:#f7f9fc !important;}
div[data-baseweb="input"], div[data-baseweb="select"] > div, div[data-baseweb="textarea"]{
  border:1px solid #dbe1e9 !important; border-radius:10px !important;}
div[data-baseweb="input"]:focus-within, div[data-baseweb="select"] > div:focus-within,
div[data-baseweb="textarea"]:focus-within{border-color:var(--kos-marca) !important;}

/* Tarjetas: st.container(border=True) abierto con ui.tarjeta() */
[data-testid="stVerticalBlockBorderWrapper"]:has(> div > [data-testid="stVerticalBlock"] > [data-testid="element-container"]:first-child .kos-tarjeta){
  background:#fff; border:1px solid var(--kos-borde) !important; border-radius:14px;
  box-shadow:0 1px 2px rgba(16,24,40,.04); padding:6px 8px;
}
[data-testid="element-container"]:has(> div > div > .kos-tarjeta),
[data-testid="element-container"]:has(.kos-tarjeta){display:none;}

/* Botones */
.stButton button, .stDownloadButton button, [data-testid="stFormSubmitButton"] button{
  border-radius:10px; font-weight:600; min-height:2.6rem; border:1px solid #d6dce5; box-shadow:none;
}
.stButton button p, .stDownloadButton button p, [data-testid="stFormSubmitButton"] button p{font-size:15px;}
.stButton button:hover, .stDownloadButton button:hover{border-color:var(--kos-marca); color:var(--kos-marca);}
button[kind="primary"], button[kind="primaryFormSubmit"]{
  background:var(--kos-marca) !important; border-color:var(--kos-marca) !important; color:#fff !important;
}
button[kind="primary"]:hover, button[kind="primaryFormSubmit"]:hover{background:#0e4d7b !important; color:#fff !important;}
button:disabled{opacity:.55;}

/* Métricas */
[data-testid="stMetric"]{background:#fff; border:1px solid var(--kos-borde); border-radius:12px; padding:14px 16px;}
[data-testid="stMetricLabel"] p{font-size:13px !important; color:var(--kos-suave) !important; font-weight:600;}
[data-testid="stMetricValue"]{font-size:26px !important; font-weight:700; color:var(--kos-texto);}
[data-testid="stMetricDelta"]{font-size:13.5px !important;}

/* Tablas y desplegables */
[data-testid="stDataFrame"]{border:1px solid var(--kos-borde); border-radius:12px; overflow:hidden; background:#fff;}
[data-testid="stExpander"] details{border:1px solid var(--kos-borde); border-radius:10px; background:#fff;}
[data-testid="stExpander"] summary p{font-weight:600; font-size:14.5px;}

/* Barra lateral */
section[data-testid="stSidebar"]{background:#fff; border-right:1px solid var(--kos-borde);}
section[data-testid="stSidebar"] .stButton button{
  justify-content:flex-start; border:none; background:transparent; color:#3b4757;
  font-weight:500; min-height:2.4rem; padding:.4rem .75rem;
}
section[data-testid="stSidebar"] .stButton button:hover{background:#f1f4f8; color:var(--kos-marca);}
section[data-testid="stSidebar"] .stButton button[kind="primary"]{
  background:var(--kos-marca-suave) !important; color:var(--kos-marca) !important;
}
section[data-testid="stSidebar"] .stButton button[kind="primary"] p{font-weight:700;}
section[data-testid="stSidebar"] hr{margin:.6rem 0;}
section[data-testid="stSidebar"] [data-testid="stVerticalBlock"]{gap:.35rem;}

/* Piezas propias */
.kos-titulo{font-size:28px; font-weight:750; letter-spacing:-.02em; color:var(--kos-texto); line-height:1.2;}
.kos-subtitulo{font-size:15.5px; color:var(--kos-suave); margin:4px 0 14px;}
.kos-seccion{display:flex; align-items:center; gap:10px; font-size:17px; font-weight:700; color:var(--kos-texto); margin:2px 0 4px;}
.kos-paso{display:inline-flex; width:26px; height:26px; border-radius:50%; background:var(--kos-marca);
  color:#fff; font-size:13.5px; align-items:center; justify-content:center;}
.kos-pastilla{display:inline-block; padding:3px 10px; border-radius:999px; font-size:13px; font-weight:600; white-space:nowrap;}
.kos-aviso{border-radius:10px; padding:12px 14px; margin:4px 0 10px; font-size:14.5px; line-height:1.45; border:1px solid;}
.kos-aviso b{display:block; font-size:15px; margin-bottom:2px;}
.kos-aviso-ok{background:#ecf8f0; border-color:#c6e9d2; color:#1d5b31;}
.kos-aviso-alerta{background:#fff8e6; border-color:#f5dfa3; color:#7a5200;}
.kos-aviso-info{background:#eef4fb; border-color:#cfe0f1; color:#0a3d62;}
.kos-aviso-error{background:#fdeeee; border-color:#f3c9c9; color:#8f1d1d;}
.kos-resumen .kos-fila{display:flex; justify-content:space-between; gap:12px; padding:7px 0; font-size:15px;
  color:#334155; border-bottom:1px dashed #e8ecf2;}
.kos-resumen .kos-fila b{color:var(--kos-texto); font-weight:600; text-align:right;}
.kos-resumen .kos-total{display:flex; justify-content:space-between; align-items:baseline; padding:12px 0 4px;
  font-size:16px; font-weight:700;}
.kos-resumen .kos-total b{font-size:26px; color:var(--kos-marca);}
.kos-vacio{border:1.5px dashed #d5dce6; border-radius:12px; padding:22px; text-align:center;
  color:var(--kos-suave); font-size:15px; background:#fbfcfd;}
.kos-marca{display:flex; align-items:center; gap:10px; padding:4px 2px 2px;}
.kos-logo{width:36px; height:36px; border-radius:10px; background:var(--kos-marca); color:#fff; display:flex;
  align-items:center; justify-content:center; font-weight:800; font-size:18px; flex:none;}
.kos-marca b{font-size:16.5px; display:block; line-height:1.15;}
.kos-marca small{font-size:12.5px; color:var(--kos-suave);}
.kos-user{display:flex; align-items:center; gap:10px; padding:10px; background:var(--kos-fondo); border-radius:10px;}
.kos-avatar{width:34px; height:34px; border-radius:50%; background:#dbe7f3; color:var(--kos-marca); display:flex;
  align-items:center; justify-content:center; font-weight:700; font-size:13.5px; flex:none;}
.kos-user b{font-size:14.5px; display:block; line-height:1.2;}
.kos-user small{font-size:12.5px; color:var(--kos-suave);}
.kos-menu{font-size:11.5px; letter-spacing:.08em; font-weight:700; color:#8a96a6; margin:10px 0 4px 4px;}
.kos-cot{line-height:1.4;}
.kos-cot b{font-size:15.5px;}
.kos-cot small{color:var(--kos-suave); font-size:13.5px;}
.kos-monto{font-size:18px; font-weight:700; color:var(--kos-texto); text-align:right;}
.kos-chips{display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin:2px 0 12px;}
.kos-chip{background:#f1f4f8; border-radius:10px; padding:8px 14px; font-size:13.5px; color:var(--kos-suave);}
.kos-chip b{display:block; font-size:18px; color:var(--kos-texto); font-weight:700;}
.kos-correo{background:#ffffff; border:1px solid #e3e8ef; border-radius:10px; padding:12px 16px;
  max-height:420px; overflow:auto; margin:4px 0 12px;}
.kos-correo p{margin:0 0 10px;}
.kos-chip small{display:block; font-size:12.5px; margin-top:3px; line-height:1.35;}
.kos-login-marca{text-align:center; margin:7vh 0 18px;}
.kos-login-marca .kos-logo{margin:0 auto 12px; width:52px; height:52px; font-size:26px; border-radius:14px;}
.kos-login-marca b{font-size:24px; display:block;}
.kos-login-marca span{color:var(--kos-suave); font-size:15px;}
</style>
"""


def aplicar_estilos() -> None:
    st.markdown(_CSS, unsafe_allow_html=True)


def esc(texto) -> str:
    """Escapa texto para incrustarlo en HTML."""
    return html.escape(str(texto if texto is not None else ""))


# ---------------------------------------------------------------------------
# Estructura de pagina
# ---------------------------------------------------------------------------


def encabezado(titulo: str, subtitulo: str = "") -> None:
    sub = f"<div class='kos-subtitulo'>{esc(subtitulo)}</div>" if subtitulo else ""
    st.markdown(f"<div class='kos-titulo'>{esc(titulo)}</div>{sub}", unsafe_allow_html=True)


@contextmanager
def tarjeta():
    """Contenedor blanco con borde suave (tarjeta)."""
    with st.container(border=True) as c:
        st.markdown("<span class='kos-tarjeta'></span>", unsafe_allow_html=True)
        yield c


def titulo_seccion(texto: str, paso: str | int | None = None) -> None:
    num = f"<span class='kos-paso'>{esc(paso)}</span>" if paso is not None else ""
    st.markdown(f"<div class='kos-seccion'>{num}{esc(texto)}</div>", unsafe_allow_html=True)


def aviso(tipo: str, titulo: str, texto: str = "") -> None:
    """tipo: ok | alerta | info | error."""
    cuerpo = f"<span>{esc(texto)}</span>" if texto else ""
    st.markdown(
        f"<div class='kos-aviso kos-aviso-{tipo}'><b>{esc(titulo)}</b>{cuerpo}</div>",
        unsafe_allow_html=True,
    )


def vacio(texto: str) -> None:
    st.markdown(f"<div class='kos-vacio'>{esc(texto)}</div>", unsafe_allow_html=True)


def resumen(filas: list[tuple[str, str]], total: tuple[str, str] | None = None) -> None:
    partes = [f"<div class='kos-fila'><span>{esc(a)}</span><b>{esc(b)}</b></div>" for a, b in filas]
    if total:
        partes.append(f"<div class='kos-total'><span>{esc(total[0])}</span><b>{esc(total[1])}</b></div>")
    st.markdown(f"<div class='kos-resumen'>{''.join(partes)}</div>", unsafe_allow_html=True)


def chips(datos: list[tuple]) -> None:
    """Fila de cifras pequenas: [(etiqueta, valor), ...] o [(etiqueta, valor, detalle), ...]."""
    partes = "".join(
        f"<div class='kos-chip'><b>{esc(d[1])}</b>{esc(d[0])}"
        + (f"<small>{esc(d[2])}</small>" if len(d) > 2 and d[2] else "") + "</div>"
        for d in datos
    )
    st.markdown(f"<div class='kos-chips'>{partes}</div>", unsafe_allow_html=True)


def pastilla_estado(estado: str) -> str:
    fondo, texto = _COLOR_ESTADO.get(estado, ("#eef1f5", "#3d4a5c"))
    return (
        f"<span class='kos-pastilla' style='background:{fondo};color:{texto}'>"
        f"{esc(ESTADO_LABEL.get(estado, estado))}</span>"
    )


# ---------------------------------------------------------------------------
# Barra lateral
# ---------------------------------------------------------------------------


def iniciales(nombre: str) -> str:
    partes = [p for p in (nombre or "").split() if p]
    return "".join(p[0] for p in partes[:2]).upper() or "?"


def marca(subtitulo: str = "Kos Colombia") -> None:
    st.markdown(
        "<div class='kos-marca'><div class='kos-logo'>K</div>"
        f"<div><b>Cotizador</b><small>{esc(subtitulo)}</small></div></div>",
        unsafe_allow_html=True,
    )


def tarjeta_usuario(usuario) -> None:
    rol = "Gerente" if usuario.rol == ROL_GERENTE else "Vendedor"
    st.markdown(
        f"<div class='kos-user'><div class='kos-avatar'>{esc(iniciales(usuario.nombre))}</div>"
        f"<div><b>{esc(usuario.nombre)}</b><small>{rol}</small></div></div>",
        unsafe_allow_html=True,
    )


def etiqueta_menu(texto: str) -> None:
    st.markdown(f"<div class='kos-menu'>{esc(texto.upper())}</div>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Tablas
# ---------------------------------------------------------------------------


def _css_color(par: tuple[str, str] | None) -> str:
    if not par:
        return ""
    return f"background-color:{par[0]}; color:{par[1]}; font-weight:600"


def _color_mercado(texto) -> str:
    """'-12% · ref ...' rojo; '-3% ...' ambar; '+5% ...' verde."""
    t = str(texto or "")
    if t.startswith("-"):
        try:
            pct = float(t[1:].split("%")[0].replace(",", "."))
        except ValueError:
            return ""
        return _css_color(("#fde8e8", "#a61b1b") if pct >= 10 else ("#fff3d6", "#8a5a00"))
    if t.startswith("+") or t.startswith("0%"):
        return _css_color(("#e2f5e7", "#1d6b35"))
    return ""


def estilizar(df: pd.DataFrame, *, col_estado: str | None = None, col_aprobacion: str | None = None,
              col_mercado: str | None = None):
    """Devuelve un Styler con color en las columnas de estado, aprobacion y/o mercado."""
    styler = df.style
    if col_mercado and col_mercado in df.columns:
        styler = styler.map(_color_mercado, subset=[col_mercado])
    if col_estado and col_estado in df.columns:
        styler = styler.map(lambda v: _css_color(_COLOR_POR_LABEL.get(v)), subset=[col_estado])
    if col_aprobacion and col_aprobacion in df.columns:
        styler = styler.map(lambda v: _css_color(_COLOR_APROBACION.get(v)), subset=[col_aprobacion])
    return styler
