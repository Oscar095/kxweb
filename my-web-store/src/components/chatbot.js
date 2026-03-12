export function initChatbot() {
  if (document.querySelector('.kos-chatbot-btn')) return;
  const n8nWebhook = "/api/chatbot";

  const style = document.createElement('style');
  style.innerHTML = `
    /* ===== CHATBOT FLOATING BUTTON ===== */
    .kos-chatbot-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 62px;
      height: 62px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary) 0%, #0077b6 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,159,227,0.45), 0 0 0 0 rgba(0,159,227,0.3);
      cursor: pointer;
      z-index: 9999;
      transition: transform 0.3s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.3s ease;
      border: none;
      animation: chatbot-pulse 2.5s infinite;
    }
    .kos-chatbot-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 28px rgba(0,159,227,0.55);
      animation: none;
    }
    .kos-chatbot-btn svg { width: 30px; height: 30px; fill: currentColor; }
    @keyframes chatbot-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(0,159,227,0.45), 0 0 0 0 rgba(0,159,227,0.3); }
      50% { box-shadow: 0 4px 20px rgba(0,159,227,0.45), 0 0 0 10px rgba(0,159,227,0); }
    }

    /* ===== CHAT WINDOW ===== */
    .kos-chatbot-window {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 380px;
      height: 540px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 140px);
      background: #f8fafc;
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06);
      z-index: 9998;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(24px) scale(0.95);
      transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .kos-chatbot-window.open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    .kos-chatbot-window.open + .kos-chatbot-btn {
      display: none !important;
    }


    /* ===== HEADER ===== */
    .kos-chatbot-header {
      background: linear-gradient(135deg, var(--primary) 0%, #0077b6 100%);
      color: #fff;
      padding: 16px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .kos-chatbot-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .kos-chatbot-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kos-chatbot-avatar svg {
      width: 20px;
      height: 20px;
      fill: #fff;
    }
    .kos-chatbot-header-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .kos-chatbot-header-name {
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 0.01em;
    }
    .kos-chatbot-header-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.78rem;
      opacity: 0.9;
    }
    .kos-status-dot {
      width: 7px;
      height: 7px;
      background: #4ade80;
      border-radius: 50%;
      animation: status-blink 2s infinite;
    }
    @keyframes status-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .kos-chatbot-close {
      background: rgba(255,255,255,0.15);
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 1.1rem;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .kos-chatbot-close:hover {
      background: rgba(255,255,255,0.3);
    }

    /* ===== MESSAGES AREA ===== */
    .kos-chatbot-messages {
      flex: 1;
      padding: 18px 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
      background: #f8fafc;
    }
    .kos-chatbot-messages::-webkit-scrollbar {
      width: 5px;
    }
    .kos-chatbot-messages::-webkit-scrollbar-track {
      background: transparent;
    }
    .kos-chatbot-messages::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.12);
      border-radius: 10px;
    }

    /* ===== MESSAGE BUBBLES ===== */
    .chatbot-msg {
      max-width: 82%;
      padding: 11px 15px;
      border-radius: 16px;
      font-size: 0.92rem;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
      animation: msg-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    @keyframes msg-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .chatbot-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, var(--primary) 0%, #0077b6 100%);
      color: #fff;
      border-bottom-right-radius: 5px;
      box-shadow: 0 2px 8px rgba(0,119,182,0.2);
    }
    .chatbot-msg.bot {
      align-self: flex-start;
      background: #fff;
      color: var(--text-main, #1e293b);
      border: 1px solid rgba(0,0,0,0.06);
      border-bottom-left-radius: 5px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .chatbot-msg-time {
      font-size: 0.68rem;
      opacity: 0.55;
      margin-top: 4px;
      display: block;
    }
    .chatbot-msg.user .chatbot-msg-time { text-align: right; }
    .chatbot-msg.bot .chatbot-msg-time { text-align: left; }

    /* ===== TYPING INDICATOR ===== */
    .typing-indicator {
      display: none;
      align-self: flex-start;
      padding: 12px 18px;
      background: #fff;
      border-radius: 16px;
      border-bottom-left-radius: 5px;
      border: 1px solid rgba(0,0,0,0.06);
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
      align-items: center;
      gap: 10px;
      animation: msg-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .typing-indicator.active {
      display: flex;
    }
    .typing-label {
      font-size: 0.82rem;
      color: var(--muted, #64748b);
      font-weight: 500;
    }
    .typing-dots {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .typing-dot {
      width: 8px;
      height: 8px;
      background: var(--primary, #009fe3);
      border-radius: 50%;
      animation: typing-bounce 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: 0s; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing-bounce {
      0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* ===== SUGGESTIONS ===== */
    .kos-chatbot-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 14px 8px;
      animation: msg-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .kos-suggestion-chip {
      background: #fff;
      border: 1px solid rgba(0,159,227,0.25);
      color: var(--primary, #009fe3);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      font-weight: 500;
    }
    .kos-suggestion-chip:hover {
      background: var(--primary, #009fe3);
      color: #fff;
      border-color: var(--primary, #009fe3);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,159,227,0.25);
    }

    /* ===== INPUT AREA ===== */
    .kos-chatbot-input {
      border-top: 1px solid rgba(0,0,0,0.06);
      padding: 12px 14px;
      display: flex;
      gap: 8px;
      background: #fff;
      flex-shrink: 0;
    }
    .kos-chatbot-input input {
      flex: 1;
      padding: 11px 16px;
      border: 1.5px solid rgba(0,0,0,0.1);
      border-radius: 24px;
      outline: none;
      background: #f8fafc;
      font-size: 0.92rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .kos-chatbot-input input:focus {
      border-color: var(--primary, #009fe3);
      box-shadow: 0 0 0 3px rgba(0,159,227,0.1);
    }
    .kos-chatbot-input input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .kos-chatbot-input button {
      background: linear-gradient(135deg, var(--primary) 0%, #0077b6 100%);
      color: #fff;
      border: none;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
    }
    .kos-chatbot-input button:hover {
      transform: scale(1.05);
      box-shadow: 0 2px 12px rgba(0,119,182,0.3);
    }
    .kos-chatbot-input button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .kos-chatbot-input button svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    /* ===== ERROR MESSAGE ===== */
    .chatbot-msg.error {
      align-self: flex-start;
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
      border-bottom-left-radius: 5px;
      box-shadow: none;
    }
    .chatbot-retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: 1px solid #dc2626;
      color: #dc2626;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.78rem;
      cursor: pointer;
      margin-top: 6px;
      transition: all 0.2s;
      font-weight: 500;
    }
    .chatbot-retry-btn:hover {
      background: #dc2626;
      color: #fff;
    }

    /* ===== WELCOME BUBBLE ===== */
    .kos-welcome-bubble {
      position: fixed;
      bottom: 96px;
      right: 24px;
      background: #fff;
      border: 1px solid rgba(0,159,227,0.2);
      border-radius: 14px;
      padding: 11px 18px;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--text-main, #1e293b);
      box-shadow: 0 6px 24px rgba(0,159,227,0.14);
      z-index: 9997;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(10px) scale(0.96);
      transition: opacity 0.4s ease, transform 0.4s ease;
      pointer-events: none;
    }
    .kos-welcome-bubble.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .kos-welcome-bubble.hiding {
      opacity: 0;
      transform: translateY(6px) scale(0.96);
    }
    .kos-welcome-bubble::after {
      content: '';
      position: absolute;
      bottom: -7px;
      right: 19px;
      width: 12px;
      height: 12px;
      background: #fff;
      border-right: 1px solid rgba(0,159,227,0.2);
      border-bottom: 1px solid rgba(0,159,227,0.2);
      transform: rotate(45deg);
    }

    /* ===== MOBILE RESPONSIVE ===== */
    @media (max-width: 480px) {
      .kos-chatbot-window {
        width: calc(100vw - 32px);
        height: auto;
        min-height: 400px;
        max-height: calc(100dvh - 120px);
        bottom: 90px;
        top: auto;
        right: 16px;
        left: 16px;
        border-radius: 20px;
        max-width: none;
      }
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.innerHTML = `
    <!-- Welcome Bubble -->
    <div class="kos-welcome-bubble" id="kos-welcome-bubble">
      Hola, soy Koski, tu Asistente Personal
    </div>

    <!-- Chat Window -->
    <div class="kos-chatbot-window">
      <div class="kos-chatbot-header">
        <div class="kos-chatbot-header-info">
          <div class="kos-chatbot-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.03 2 11c0 2.82 1.494 5.334 3.824 6.953C5.617 19.344 5.166 21 5.166 21s1.777-.113 3.655-1.121C9.696 20.301 10.82 20.5 12 20.5c5.523 0 10-4.03 10-9s-4.477-9-10-9z"/></svg>
          </div>
          <div class="kos-chatbot-header-text">
            <span class="kos-chatbot-header-name">Koski Agent</span>
            <span class="kos-chatbot-header-status"><span class="kos-status-dot"></span> En linea</span>
          </div>
        </div>
        <button class="kos-chatbot-close">&#x2715;</button>
      </div>
      <div class="kos-chatbot-messages" id="chatbot-msg-container">
        <div class="chatbot-msg bot">Hola! Soy Koski, tu asistente de IA. Estoy aqui para ayudarte en lo que necesites.</div>
        <div class="kos-chatbot-suggestions" id="chatbot-suggestions">
          <button class="kos-suggestion-chip" data-msg="Quiero hacer un pedido">Hacer un pedido</button>
          <button class="kos-suggestion-chip" data-msg="Necesito informacion sobre sus productos">Informacion de productos</button>
          <button class="kos-suggestion-chip" data-msg="Necesito ayuda con mi pedido">Ayuda con mi pedido</button>
        </div>
        <div class="typing-indicator" id="chatbot-typing">
          <span class="typing-label">Escribiendo</span>
          <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
      <form class="kos-chatbot-input" id="chatbot-form">
        <input type="text" id="chatbot-input" placeholder="Escribe tu mensaje..." autocomplete="off"/>
        <button type="submit" aria-label="Enviar">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </form>
    </div>

    <!-- Floating Button (Moved after window for CSS sibling selector) -->
    <button class="kos-chatbot-btn" aria-label="Abrir chat">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.03 2 11c0 2.82 1.494 5.334 3.824 6.953C5.617 19.344 5.166 21 5.166 21s1.777-.113 3.655-1.121C9.696 20.301 10.82 20.5 12 20.5c5.523 0 10-4.03 10-9s-4.477-9-10-9z"/></svg>
    </button>

  `;
  document.body.appendChild(container);

  const btnOpen = container.querySelector('.kos-chatbot-btn');
  const btnClose = container.querySelector('.kos-chatbot-close');
  const windowEl = container.querySelector('.kos-chatbot-window');
  const form = container.querySelector('#chatbot-form');
  const input = container.querySelector('#chatbot-input');
  const submitBtn = form.querySelector('button[type="submit"]');
  const msgContainer = container.querySelector('#chatbot-msg-container');
  const typingInd = container.querySelector('#chatbot-typing');
  const suggestionsEl = container.querySelector('#chatbot-suggestions');

  const toggleWindow = () => {
    windowEl.classList.toggle('open');
    const isOpen = windowEl.classList.contains('open');
    if (isOpen) {
      input.focus();
      btnOpen.style.display = 'none';
    } else {
      btnOpen.style.display = '';
    }
  };

  // Welcome bubble logic
  const bubble = container.querySelector('#kos-welcome-bubble');
  const hideBubble = () => {
    if (!bubble) return;
    bubble.classList.add('hiding');
    setTimeout(() => bubble.remove(), 400);
  };
  setTimeout(() => {
    if (!bubble) return;
    bubble.classList.add('visible');
    setTimeout(hideBubble, 4500);
  }, 1200);

  btnOpen.addEventListener('click', () => { hideBubble(); toggleWindow(); });
  btnClose.addEventListener('click', toggleWindow);

  // Time formatter
  const getTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
  };

  const appendMessage = (text, sender, isError = false) => {
    const div = document.createElement('div');
    div.className = `chatbot-msg ${sender}${isError ? ' error' : ''}`;

    let content = '';
    if (sender === 'bot' && !isError) {
      let formattedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      content = formattedText;
    } else if (isError) {
      content = text;
    } else {
      content = document.createElement('span');
      content.textContent = text;
      content = content.innerHTML;
    }

    div.innerHTML = `${content}<span class="chatbot-msg-time">${getTime()}</span>`;
    msgContainer.insertBefore(div, typingInd);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return div;
  };

  const appendError = (errorText, lastUserMsg) => {
    const div = document.createElement('div');
    div.className = 'chatbot-msg bot error';

    const escapedText = errorText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    div.innerHTML = `${escapedText}<span class="chatbot-msg-time">${getTime()}</span>`;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'chatbot-retry-btn';
    retryBtn.innerHTML = '&#x21bb; Reintentar';
    retryBtn.addEventListener('click', () => {
      div.remove();
      sendMessage(lastUserMsg);
    });
    div.appendChild(retryBtn);

    msgContainer.insertBefore(div, typingInd);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  };

  const showTyping = (show) => {
    if (show) {
      typingInd.classList.add('active');
    } else {
      typingInd.classList.remove('active');
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
  };

  const setInputEnabled = (enabled) => {
    input.disabled = !enabled;
    submitBtn.disabled = !enabled;
  };

  const sessionId = Math.random().toString(36).substring(2, 15);

  // Suggestion chips
  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.kos-suggestion-chip');
      if (!chip) return;
      const msg = chip.getAttribute('data-msg');
      if (msg) {
        suggestionsEl.remove();
        appendMessage(msg, 'user');
        sendMessage(msg);
      }
    });
  }

  const sendMessage = async (text) => {
    showTyping(true);
    setInputEnabled(false);

    try {
      const response = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })
      });

      showTyping(false);
      setInputEnabled(true);

      if (response.ok) {
        const textResponse = await response.text();
        let replyText;
        try {
          const jsonResponse = JSON.parse(textResponse);
          replyText = jsonResponse.output || jsonResponse.message || jsonResponse.reply || null;

          if (!replyText) {
            if (typeof jsonResponse === 'string') {
              replyText = jsonResponse;
            } else if (Array.isArray(jsonResponse) && jsonResponse.length > 0) {
              replyText = jsonResponse[0].output || jsonResponse[0].message || jsonResponse[0].reply || null;
            }
          }

          if (!replyText) {
            appendError('Lo siento, no pude procesar la respuesta. Por favor intenta de nuevo.', text);
            return;
          }
        } catch {
          replyText = textResponse && textResponse.trim() ? textResponse : null;
          if (!replyText) {
            appendError('Recibi una respuesta vacia. Por favor intenta de nuevo.', text);
            return;
          }
        }
        appendMessage(replyText, 'bot');
      } else {
        appendError('Ocurrio un problema al procesar tu solicitud. Por favor intenta de nuevo en unos momentos.', text);
      }

      input.focus();
    } catch (err) {
      console.error('Chatbot error:', err);
      showTyping(false);
      setInputEnabled(true);
      appendError('No pude conectar con el servidor. Verifica tu conexion e intenta de nuevo.', text);
      input.focus();
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Remove suggestions on first user message
    if (suggestionsEl && suggestionsEl.parentNode) {
      suggestionsEl.remove();
    }

    appendMessage(text, 'user');
    input.value = '';
    sendMessage(text);
  });
}
