import { renderHeader } from './components/header.js?v=999';

renderHeader(document.getElementById('site-header'));

// ── SVG icons ────────────────────────────────────────────────
const ICON_SUCCESS = `
  <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"
       width="56" height="56">
    <circle cx="26" cy="26" r="24" stroke="#16a34a" stroke-width="2.5"/>
    <path d="M15 27l8 8 14-16" stroke="#16a34a" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const ICON_PENDING = `
  <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"
       width="56" height="56">
    <circle cx="26" cy="26" r="24" stroke="#d97706" stroke-width="2.5"/>
    <path d="M26 15v11l7 4" stroke="#d97706" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const ICON_FAILED = `
  <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"
       width="56" height="56">
    <circle cx="26" cy="26" r="24" stroke="#dc2626" stroke-width="2.5"/>
    <path d="M18 18l16 16M34 18L18 34" stroke="#dc2626" stroke-width="3"
          stroke-linecap="round"/>
  </svg>`;

// ── Helpers ───────────────────────────────────────────────────
function qs(id) { return document.getElementById(id); }

function safeText(s) {
  return String(s == null ? '' : s);
}

function getParams() {
  return new URL(location.href).searchParams;
}

function pickTransactionId(p) {
  return p.get('id') || p.get('transactionId') || p.get('transaction_id') || p.get('transaction');
}

function clearCart() {
  try { localStorage.removeItem('cart'); } catch (_) { /* noop */ }
}

// ── State renderers ───────────────────────────────────────────

/**
 * Set the icon area to a given state (loading | success | pending | failed)
 * and swap in the appropriate SVG.
 */
function setIcon(state) {
  const wrap = qs('confirm-icon');
  if (!wrap) return;
  wrap.className = `confirm-icon-wrap ${state}`;
  if (state === 'loading') {
    wrap.innerHTML = '<div class="spinner"></div>';
  } else if (state === 'success') {
    wrap.innerHTML = ICON_SUCCESS;
  } else if (state === 'pending') {
    wrap.innerHTML = ICON_PENDING;
  } else {
    wrap.innerHTML = ICON_FAILED;
  }
}

function setTitle(text, state) {
  const el = qs('confirm-title');
  if (!el) return;
  el.textContent = text;
  el.className = `confirm-title${state ? ' ' + state : ''}`;
}

function setSubtitle(text) {
  const el = qs('confirm-subtitle');
  if (el) el.textContent = text;
}

function showOrderBadge(pedidoId) {
  const badge = qs('order-badge');
  const num   = qs('order-number');
  if (badge && num) {
    num.textContent = `#${safeText(pedidoId)}`;
    badge.style.display = '';
  }
}

function buildStatusChip(estado) {
  const isApproved = estado === 'APPROVED' || estado === 'APPROVED_PARTIAL' || estado === 'APROBADA';
  const isPending  = estado === 'PENDING';
  const cls = isApproved ? 'success' : isPending ? 'pending' : 'failed';
  const dot = isApproved ? '●' : isPending ? '◷' : '✕';
  const label = isApproved ? 'Aprobado' : isPending ? 'Pendiente' : (estado || 'Rechazado');
  return `<span class="status-chip ${cls}">${dot} ${label}</span>`;
}

function showDetails(transactionId, estado) {
  const box = qs('confirm-details');
  if (!box) return;

  // Transaction row
  if (transactionId) {
    const row = qs('row-transaction');
    const val = qs('detail-transaction');
    if (row && val) {
      val.textContent = safeText(transactionId);
      row.style.display = '';
    }
  }

  // Status chip
  const statusEl = qs('detail-status');
  if (statusEl) {
    statusEl.innerHTML = buildStatusChip(estado);
  }

  box.style.display = '';
}

function showActions() {
  const el = qs('confirm-actions');
  if (el) el.style.display = '';
}

function showNote() {
  const el = qs('confirm-note');
  if (el) el.style.display = '';
}

// ── Render final states ───────────────────────────────────────

function renderSuccess(pedidoId, transactionId, estado) {
  setIcon('success');
  setTitle('¡Pago confirmado!', 'success');
  setSubtitle('Tu pedido ha sido recibido y está siendo procesado.');
  showOrderBadge(pedidoId);
  showDetails(transactionId, estado);
  showActions();
  showNote();
  clearCart();
}

function renderPending(pedidoId, transactionId, estado) {
  setIcon('pending');
  setTitle('Pago en proceso', 'pending');
  setSubtitle('Tu transacción está siendo verificada. Recibirás una notificación pronto.');
  if (pedidoId) showOrderBadge(pedidoId);
  showDetails(transactionId, estado);
  showActions();
  showNote();
}

function renderFailed(pedidoId, transactionId, estado, reason) {
  setIcon('failed');
  setTitle('Pago no completado', 'failed');
  setSubtitle(reason || 'No se pudo procesar el pago. Por favor intenta de nuevo o contáctanos.');
  if (pedidoId) showOrderBadge(pedidoId);
  if (transactionId || estado) showDetails(transactionId, estado);
  showActions();
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const p = getParams();
  const pedidoId          = p.get('pedidoId');
  const statusFromRedirect = p.get('status');
  const transactionId      = pickTransactionId(p);

  // Muestra el número de pedido de inmediato mientras se verifica
  if (pedidoId) showOrderBadge(pedidoId);

  if (!pedidoId) {
    renderFailed(null, null, null, 'No se encontró el identificador del pedido en la URL.');
    return;
  }

  if (!transactionId) {
    // Wompi no devolvió transaction id — probablemente fue cancelado
    const estado = safeText(statusFromRedirect).toUpperCase();
    if (estado === 'DECLINED' || estado === 'ERROR' || estado === 'VOIDED') {
      renderFailed(pedidoId, null, estado, 'La transacción fue rechazada o cancelada.');
    } else {
      renderFailed(pedidoId, null, estado, 'No se recibió el ID de transacción. Si realizaste el pago, contáctanos.');
    }
    return;
  }

  try {
    const resp = await fetch(`/api/pedidos/${encodeURIComponent(pedidoId)}/confirmar-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId })
    });

    const ct   = (resp.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json')
      ? await resp.json().catch(() => ({}))
      : { raw: await resp.text().catch(() => '') };

    if (!resp.ok) {
      renderFailed(pedidoId, transactionId, statusFromRedirect, 'No se pudo verificar el pago con el servidor.');
      return;
    }

    const estado = safeText(data.payment_status || data.status || statusFromRedirect || '').toUpperCase();
    const txId   = safeText(data.id_wompi || transactionId);
    const pid    = safeText(data.pedidoId ?? pedidoId);

    const isApproved = estado === 'APPROVED' || estado === 'APPROVED_PARTIAL' || estado === 'APROBADA';
    const isPending  = estado === 'PENDING';

    if (isApproved) {
      renderSuccess(pid, txId, estado);
    } else if (isPending) {
      renderPending(pid, txId, estado);
    } else {
      renderFailed(pid, txId, estado, null);
    }

  } catch (err) {
    renderFailed(
      pedidoId,
      transactionId,
      statusFromRedirect,
      `Error de conexión: ${safeText(err?.message || err)}`
    );
  }
}

main();
