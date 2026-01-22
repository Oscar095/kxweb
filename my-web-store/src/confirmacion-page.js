import { renderHeader } from './components/header.js';

renderHeader(document.getElementById('site-header'));

function getParams() {
  return new URL(location.href).searchParams;
}

function pickTransactionId(p) {
  // Wompi suele devolver id/status en el redirect. Dejamos fallback por si cambia.
  return p.get('id') || p.get('transactionId') || p.get('transaction_id') || p.get('transaction');
}

function safeText(s) {
  return String(s == null ? '' : s);
}

async function main() {
  const box = document.getElementById('confirm-box');
  const p = getParams();

  const pedidoId = p.get('pedidoId');
  const statusFromRedirect = p.get('status');
  const transactionId = pickTransactionId(p);

  if (!pedidoId) {
    box.textContent = 'No se encontró el id del pedido (pedidoId).';
    return;
  }

  box.innerHTML = `
    <div style="color:black;">Pedido: <strong>#${safeText(pedidoId)}</strong></div>
    <div style="margin-top:6px;">Verificando pago...</div>
  `;

  if (!transactionId) {
    box.innerHTML = `
      <div style="color:black;">Pedido: <strong>#${safeText(pedidoId)}</strong></div>
      <div style="margin-top:6px;color:#b00020;font-weight:700;">No se recibió el id de transacción en el redirect.</div>
      ${statusFromRedirect ? `<div style="margin-top:6px;color:#555;">Estado (redirect): ${safeText(statusFromRedirect)}</div>` : ''}
    `;
    return;
  }

  try {
    const resp = await fetch(`/api/pedidos/${encodeURIComponent(pedidoId)}/confirmar-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId })
    });

    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await resp.json().catch(() => ({})) : { raw: await resp.text().catch(() => '') };

    if (!resp.ok) {
      box.innerHTML = `
        <div style="color:black;">Pedido: <strong>#${safeText(pedidoId)}</strong></div>
        <div style="margin-top:6px;color:#b00020;font-weight:700;">No se pudo verificar el pago.</div>
        <pre style="margin-top:10px;background:#fafafa;border:1px solid #eee;padding:10px;border-radius:8px;white-space:pre-wrap;">${safeText(JSON.stringify(data, null, 2))}</pre>
      `;
      return;
    }

    const estado = safeText(data.payment_status || data.status || statusFromRedirect || '');
    const ok = estado === 'APPROVED' || estado === 'APPROVED_PARTIAL' || estado === 'APROBADA';

    box.innerHTML = `
      <div style="color:black;">Pedido: <strong>#${safeText(data.pedidoId ?? pedidoId)}</strong></div>
      <div style="margin-top:6px;">Transacción: <strong>${safeText(data.id_wompi || transactionId)}</strong></div>
      <div style="margin-top:6px;color:${ok ? '#0a7a28' : '#b00020'};font-weight:800;">Estado: ${estado || 'PENDING'}</div>
    `;
  } catch (e) {
    box.innerHTML = `
      <div style="color:black;">Pedido: <strong>#${safeText(pedidoId)}</strong></div>
      <div style="margin-top:6px;color:#b00020;font-weight:700;">Error verificando el pago.</div>
      <div style="margin-top:6px;color:#555;">${safeText(e?.message || e)}</div>
    `;
  }
}

main();
