export function initChatbot() {
  if (document.querySelector('.kos-chatbot-btn')) return;
  const n8nWebhook = "/api/chatbot";

  const style = document.createElement('style');
  style.innerHTML = `
    .kos-chatbot-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,159,227,0.4);
      cursor: pointer;
      z-index: 9999;
      transition: transform 0.3s ease;
      border: 2px solid rgba(255,255,255,0.2);
    }
    .kos-chatbot-btn:hover {
      transform: scale(1.1);
    }
    .kos-chatbot-btn svg { width: 32px; height: 32px; fill: currentColor; }

    .kos-chatbot-window {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 350px;
      height: 500px;
      max-width: calc(100vw - 48px);
      background: var(--glass-bg, rgba(255,255,255,0.85));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.3));
      border-radius: 16px;
      box-shadow: var(--glass-shadow, 0 8px 32px rgba(0,0,0,0.15));
      z-index: 9998;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px);
      transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .kos-chatbot-window.open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .kos-chatbot-header {
      background: linear-gradient(135deg, var(--primary) 0%, #007FB6 100%);
      color: #fff;
      padding: 16px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .kos-chatbot-close {
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 1.2rem;
    }

    .kos-chatbot-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .chatbot-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 0.95rem;
      line-height: 1.4;
      word-wrap: break-word;
    }
    .chatbot-msg.user {
      align-self: flex-end;
      background: var(--primary);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .chatbot-msg.bot {
      align-self: flex-start;
      background: #fff;
      color: var(--text-main);
      border: 1px solid rgba(0,0,0,0.05);
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }

    .kos-chatbot-input {
      border-top: 1px solid var(--glass-border);
      padding: 12px;
      display: flex;
      gap: 8px;
      background: rgba(255,255,255,0.6);
    }
    .kos-chatbot-input input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 20px;
      outline: none;
      background: rgba(255,255,255,0.8);
      font-size: 0.95rem;
    }
    .kos-chatbot-input input:focus {
      border-color: var(--primary);
    }
    .kos-chatbot-input button {
      background: var(--primary);
      color: #fff;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .kos-chatbot-input button:hover {
      background: #007FB6;
    }
    .kos-chatbot-input button svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    
    .typing-indicator {
      display: none;
      padding: 10px 14px;
      background: #fff;
      align-self: flex-start;
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(0,0,0,0.05);
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .typing-indicator.active {
      display: flex;
      gap: 4px;
    }
    .typing-dot {
      width: 6px;
      height: 6px;
      background: var(--muted, #64748b);
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes typing {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.innerHTML = `
    <!-- Floating Button -->
    <button class="kos-chatbot-btn" aria-label="Abrir chat">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.03 2 11c0 2.82 1.494 5.334 3.824 6.953C5.617 19.344 5.166 21 5.166 21s1.777-.113 3.655-1.121C9.696 20.301 10.82 20.5 12 20.5c5.523 0 10-4.03 10-9s-4.477-9-10-9z"/></svg>
    </button>
    
    <!-- Chat Window -->
    <div class="kos-chatbot-window">
      <div class="kos-chatbot-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg style="width:20px;height:20px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.03 2 11c0 2.82 1.494 5.334 3.824 6.953C5.617 19.344 5.166 21 5.166 21s1.777-.113 3.655-1.121C9.696 20.301 10.82 20.5 12 20.5c5.523 0 10-4.03 10-9s-4.477-9-10-9z"/></svg>
          <span>Asistente KOS</span>
        </div>
        <button class="kos-chatbot-close">✕</button>
      </div>
      <div class="kos-chatbot-messages" id="chatbot-msg-container">
        <div class="chatbot-msg bot">¡Hola! Soy tu asistente virtual de Kos Xpress. ¿En qué te puedo ayudar hoy? 😊</div>
        <div class="typing-indicator" id="chatbot-typing">
          <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
        </div>
      </div>
      <form class="kos-chatbot-input" id="chatbot-form">
        <input type="text" id="chatbot-input" placeholder="Escribe tu mensaje..." autocomplete="off"/>
        <button type="submit" aria-label="Enviar">
          <svg viewBox="0 0 24 24"><path d="M22 2v20l-20-10z"/></svg>
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(container);

  const btnOpen = container.querySelector('.kos-chatbot-btn');
  const btnClose = container.querySelector('.kos-chatbot-close');
  const windowEl = container.querySelector('.kos-chatbot-window');
  const form = container.querySelector('#chatbot-form');
  const input = container.querySelector('#chatbot-input');
  const msgContainer = container.querySelector('#chatbot-msg-container');
  const typingInd = container.querySelector('#chatbot-typing');

  const toggleWindow = () => {
    windowEl.classList.toggle('open');
    if (windowEl.classList.contains('open')) input.focus();
  };

  btnOpen.addEventListener('click', toggleWindow);
  btnClose.addEventListener('click', toggleWindow);

  const appendMessage = (text, sender) => {
    const div = document.createElement('div');
    div.className = `chatbot-msg ${sender}`;
    div.textContent = text;
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

  const sessionId = Math.random().toString(36).substring(2, 15);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    input.value = '';
    showTyping(true);

    try {
      const response = await fetch(n8nWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })
      });

      let replyText = "Lo siento, ha ocurrido un error de conexión.";
      if (response.ok) {
        const textResponse = await response.text();
        try {
          const jsonResponse = JSON.parse(textResponse);
          replyText = jsonResponse.output || jsonResponse.message || jsonResponse.reply || textResponse;
        } catch {
          replyText = textResponse;
        }
      } else {
        const textResponse = await response.text();
        replyText = `⚠️ Error de n8n (Código ${response.status}): Por favor asegúrate de darle clic a "Listen for test event" en tu flujo de n8n si usas webhook-test. Detalles: ${textResponse}`;
      }

      showTyping(false);
      appendMessage(replyText, 'bot');
    } catch (err) {
      console.error('Chatbot error:', err);
      showTyping(false);
      appendMessage("Lo siento, no pude contactar al servidor en este momento.", 'bot');
    }
  });
}
