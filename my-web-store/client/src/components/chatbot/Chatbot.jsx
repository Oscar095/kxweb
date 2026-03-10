import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Chatbot.module.css';

const WEBHOOK_URL = '/api/chatbot';
const SESSION_ID = Math.random().toString(36).substring(2, 15);

const SUGGESTIONS = [
  { label: 'Hacer un pedido', msg: 'Quiero hacer un pedido' },
  { label: 'Informacion de productos', msg: 'Necesito informacion sobre sus productos' },
  { label: 'Ayuda con mi pedido', msg: 'Necesito ayuda con mi pedido' },
];

function getTime() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatBotText(text) {
  const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 'welcome', text: 'Hola! Soy Koski, tu asistente de IA. Estoy aqui para ayudarte en lo que necesites.', sender: 'bot', time: getTime() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(scrollToBottom, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const sendMessage = useCallback(async (text) => {
    setIsTyping(true);
    setIsDisabled(true);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: SESSION_ID,
          timestamp: new Date().toISOString(),
        }),
      });

      setIsTyping(false);
      setIsDisabled(false);

      if (response.ok) {
        const textResponse = await response.text();
        let replyText;
        try {
          const json = JSON.parse(textResponse);
          replyText = json.output || json.message || json.reply || null;
          if (!replyText && typeof json === 'string') replyText = json;
          if (!replyText && Array.isArray(json) && json.length > 0) {
            replyText = json[0].output || json[0].message || json[0].reply || null;
          }
        } catch {
          replyText = textResponse?.trim() || null;
        }

        if (replyText) {
          setMessages((prev) => [...prev, {
            id: Date.now() + '-bot',
            text: replyText,
            sender: 'bot',
            time: getTime(),
          }]);
        } else {
          setMessages((prev) => [...prev, {
            id: Date.now() + '-err',
            text: 'Lo siento, no pude procesar la respuesta.',
            sender: 'error',
            time: getTime(),
            retryMsg: text,
          }]);
        }
      } else {
        setMessages((prev) => [...prev, {
          id: Date.now() + '-err',
          text: 'Ocurrio un problema al procesar tu solicitud.',
          sender: 'error',
          time: getTime(),
          retryMsg: text,
        }]);
      }
    } catch {
      setIsTyping(false);
      setIsDisabled(false);
      setMessages((prev) => [...prev, {
        id: Date.now() + '-err',
        text: 'No pude conectar con el servidor.',
        sender: 'error',
        time: getTime(),
        retryMsg: text,
      }]);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setShowSuggestions(false);
    setMessages((prev) => [...prev, {
      id: Date.now() + '-user',
      text,
      sender: 'user',
      time: getTime(),
    }]);
    setInput('');
    sendMessage(text);
  };

  const handleSuggestion = (msg) => {
    setShowSuggestions(false);
    setMessages((prev) => [...prev, {
      id: Date.now() + '-user',
      text: msg,
      sender: 'user',
      time: getTime(),
    }]);
    sendMessage(msg);
  };

  const handleRetry = (retryMsg, errorId) => {
    setMessages((prev) => prev.filter((m) => m.id !== errorId));
    sendMessage(retryMsg);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        className={styles.btn}
        onClick={() => setIsOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        aria-label="Abrir chat"
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.03 2 11c0 2.82 1.494 5.334 3.824 6.953C5.617 19.344 5.166 21 5.166 21s1.777-.113 3.655-1.121C9.696 20.301 10.82 20.5 12 20.5c5.523 0 10-4.03 10-9s-4.477-9-10-9z"/>
        </svg>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.window}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className={styles.chatHeader}>
              <div className={styles.headerInfo}>
                <div className={styles.avatar}>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.03 2 11c0 2.82 1.494 5.334 3.824 6.953C5.617 19.344 5.166 21 5.166 21s1.777-.113 3.655-1.121C9.696 20.301 10.82 20.5 12 20.5c5.523 0 10-4.03 10-9s-4.477-9-10-9z"/>
                  </svg>
                </div>
                <div>
                  <div className={styles.headerName}>Koski Agent</div>
                  <div className={styles.headerStatus}>
                    <span className={styles.statusDot} /> En linea
                  </div>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                &#x2715;
              </button>
            </div>

            <div className={styles.messages} ref={messagesRef}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={
                    msg.sender === 'user'
                      ? styles.msgUser
                      : msg.sender === 'error'
                        ? styles.msgError
                        : styles.msgBot
                  }
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {msg.sender === 'bot' ? (
                    <span dangerouslySetInnerHTML={{ __html: formatBotText(msg.text) }} />
                  ) : (
                    msg.text
                  )}
                  <span className={styles.msgTime}>{msg.time}</span>
                  {msg.sender === 'error' && msg.retryMsg && (
                    <button
                      className={styles.retryBtn}
                      onClick={() => handleRetry(msg.retryMsg, msg.id)}
                    >
                      &#x21bb; Reintentar
                    </button>
                  )}
                </motion.div>
              ))}

              {showSuggestions && (
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.msg}
                      className={styles.chip}
                      onClick={() => handleSuggestion(s.msg)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {isTyping && (
                <motion.div
                  className={styles.typing}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className={styles.typingLabel}>Escribiendo</span>
                  <div className={styles.typingDots}>
                    <div className={styles.dot} />
                    <div className={styles.dot} />
                    <div className={styles.dot} />
                  </div>
                </motion.div>
              )}
            </div>

            <form className={styles.inputArea} onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                className={styles.inputField}
                placeholder="Escribe tu mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isDisabled}
                autoComplete="off"
              />
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={isDisabled || !input.trim()}
                aria-label="Enviar"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
