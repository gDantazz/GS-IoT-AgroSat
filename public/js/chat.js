/**
 * Chat Module
 * Interface de chat com o assistente IA (Google Gemini)
 */

const Chat = (() => {
  let isOpen = false;
  let isLoading = false;
  let messageHistory = [];

  /**
   * Inicializa o módulo de chat
   */
  function init() {
    // Toggle chat
    document.getElementById('chatToggle').addEventListener('click', toggle);
    document.getElementById('chatClose').addEventListener('click', close);

    // Enviar mensagem
    document.getElementById('chatSend').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Sugestões rápidas
    document.querySelectorAll('.chat__suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.dataset.msg;
        if (msg) {
          document.getElementById('chatInput').value = msg;
          sendMessage();
        }
      });
    });

    // Mensagem de boas-vindas
    addMessage('ai', '👋 Olá! Sou o **AgroSat AI**, seu assistente agrícola inteligente.\n\nSelecione uma localização no mapa ou digite as coordenadas para que eu possa analisar os dados de satélite da sua região e te ajudar com recomendações para sua lavoura! 🌱');
  }

  /**
   * Abre/fecha o painel do chat
   */
  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById('chatPanel');
    const badge = document.getElementById('chatBadge');

    if (isOpen) {
      panel.classList.add('chat__panel--open');
      badge.style.display = 'none';
      document.getElementById('chatInput').focus();
    } else {
      panel.classList.remove('chat__panel--open');
    }
  }

  function close() {
    isOpen = false;
    document.getElementById('chatPanel').classList.remove('chat__panel--open');
  }

  /**
   * Envia mensagem para a API
   */
  async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || isLoading) return;

    // Mostrar mensagem do usuário
    addMessage('user', message);
    input.value = '';

    // Mostrar indicador de digitação
    isLoading = true;
    showTyping();
    document.getElementById('chatSend').disabled = true;

    try {
      // Filtrar histórico (excluindo mensagem de boas-vindas inicial e a mensagem atual do usuário)
      const filteredHistory = messageHistory.slice(1, -1);
      
      // Limitar o histórico de conversas às últimas 10 mensagens (5 rodadas de conversa)
      const maxHistory = 10;
      const historySlice = filteredHistory.length > maxHistory 
        ? filteredHistory.slice(filteredHistory.length - maxHistory) 
        : filteredHistory;

      const history = historySlice.map(msg => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        content: msg.content
      }));

      // Montar contexto com dados atuais, leituras de sensores IoT e histórico
      const sensorData = typeof IotModule !== 'undefined' ? IotModule.getCurrentReadings() : null;

      const context = {
        message,
        location: App.getLocation(),
        climateData: Dashboard.getData(),
        ndviData: Dashboard.getNDVI(),
        events: MapModule.getEvents()?.slice(0, 10),
        sensorData,
        history
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });

      const data = await response.json();

      hideTyping();

      if (response.ok) {
        addMessage('ai', data.response);
      } else {
        addMessage('ai', `⚠️ ${data.error || 'Desculpe, ocorreu um erro.'}\n\n${data.details || ''}`);
      }
    } catch (error) {
      hideTyping();
      addMessage('ai', '⚠️ Não foi possível conectar ao assistente IA. Verifique se o servidor está rodando e se a GEMINI_API_KEY está configurada no arquivo .env');
    } finally {
      isLoading = false;
      document.getElementById('chatSend').disabled = false;
    }
  }

  /**
   * Adiciona mensagem ao chat
   */
  function addMessage(role, content) {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat__message chat__message--${role}`;

    const formattedContent = formatMarkdown(content);

    if (role === 'ai') {
      messageDiv.innerHTML = `
        <div class="chat__message-avatar">🤖</div>
        <div class="chat__message-bubble">${formattedContent}</div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div class="chat__message-bubble">${formattedContent}</div>
      `;
    }

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;

    messageHistory.push({ role, content });
  }

  /**
   * Mostra indicador de digitação
   */
  function showTyping() {
    const container = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'chatTyping';
    typingDiv.className = 'chat__message chat__message--ai';
    typingDiv.innerHTML = `
      <div class="chat__message-avatar">🤖</div>
      <div class="chat__typing">
        <div class="chat__typing-dot"></div>
        <div class="chat__typing-dot"></div>
        <div class="chat__typing-dot"></div>
      </div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById('chatTyping');
    if (typing) typing.remove();
  }

  /**
   * Formata markdown básico para HTML
   */
  function formatMarkdown(text) {
    if (!text) return '';

    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Lists
      .replace(/^[-•]\s(.+)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Numbered lists
      .replace(/^\d+\.\s(.+)/gm, '<li>$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      // Wrap in paragraphs
      .replace(/^(.+)$/s, '<p>$1</p>');
  }

  /**
   * Notifica o chat quando uma nova localização é selecionada
   */
  function notifyLocationChange(lat, lon) {
    if (!isOpen) {
      const badge = document.getElementById('chatBadge');
      badge.style.display = 'flex';
    }
  }

  return {
    init,
    toggle,
    close,
    notifyLocationChange,
    addMessage
  };
})();
