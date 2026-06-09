/**
 * IoT and History Module
 * Gerencia a simulação dos sensores IoT e renderiza o histórico de buscas do Oracle DB
 */

const IotModule = (() => {
  let latestReadings = null;

  /**
   * Inicializa o módulo
   */
  function init() {
    setupSliders();
    setupForm();
    setupHistory();
    loadHistory();
  }

  /**
   * Sincroniza os sliders de range com o texto exibido
   */
  function setupSliders() {
    const sliders = [
      { id: 'soilHumidity', valId: 'soilHumidityVal' },
      { id: 'airTemp', valId: 'airTempVal' },
      { id: 'soilPh', valId: 'soilPhVal' }
    ];

    sliders.forEach(slider => {
      const sliderEl = document.getElementById(slider.id);
      const valEl = document.getElementById(slider.valId);

      if (sliderEl && valEl) {
        sliderEl.addEventListener('input', () => {
          valEl.textContent = sliderEl.value;
        });
      }
    });
  }

  /**
   * Gerencia a submissão dos dados dos sensores
   */
  function setupForm() {
    const form = document.getElementById('iotForm');
    const feedback = document.getElementById('iotFeedback');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const location = App.getLocation();
      if (!location) {
        showFeedback('Por favor, selecione uma localização no mapa antes de enviar os dados do sensor.', 'error');
        return;
      }

      const soilHumidity = parseFloat(document.getElementById('soilHumidity').value);
      const airTemp = parseFloat(document.getElementById('airTemp').value);
      const soilPh = parseFloat(document.getElementById('soilPh').value);

      const payload = {
        latitude: location.lat,
        longitude: location.lon,
        umidade_solo: soilHumidity,
        temperatura_ar: airTemp,
        ph_solo: soilPh
      };

      try {
        const response = await fetch('/api/iot/readings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          latestReadings = payload;
          showFeedback('Telemetria IoT enviada e salva no banco de dados!', 'success');

          // Opcional: Adicionar mensagem automática no chat notificando o envio
          if (typeof Chat !== 'undefined' && Chat.addMessage) {
            Chat.addMessage('ai', `📡 **Telemetria IoT Recebida:** Dados do sensor local de campo (Umidade do Solo: **${soilHumidity}%**, Temp. do Ar: **${airTemp}°C**, pH: **${soilPh}**) foram integrados à minha análise da sua lavoura. O que deseja saber agora?`);
          }
        } else {
          showFeedback(`Erro ao salvar: ${data.error}`, 'error');
        }
      } catch (err) {
        console.error('Erro ao enviar dados do sensor:', err);
        showFeedback('Erro de rede ao conectar com o serviço IoT.', 'error');
      }
    });
  }

  /**
   * Registra botões de histórico
   */
  function setupHistory() {
    const refreshBtn = document.getElementById('historyRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadHistory);
    }
  }

  /**
   * Carrega o histórico de buscas do banco
   */
  async function loadHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    try {
      const response = await fetch('/api/nasa/history?limit=6');
      if (!response.ok) throw new Error('Erro ao carregar histórico');

      const history = await response.json();
      renderHistory(history);
    } catch (error) {
      console.error('Erro ao carregar histórico de buscas:', error);
      container.innerHTML = `
        <div class="history__empty">
          <p>Não foi possível carregar o histórico de buscas do OracleDB.</p>
        </div>
      `;
    }
  }

  /**
   * Renderiza a lista de buscas no DOM
   */
  function renderHistory(items) {
    const container = document.getElementById('historyList');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="history__empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Nenhuma busca salva ainda. Pesquise coordenadas ou clique no mapa para registrar uma análise.</p>
        </div>
      `;
      return;
    }

    const html = items.map(item => {
      const rawDate = item.DATA_BUSCA || item.data_busca || item.DATA_LEITURA || item.data_leitura;
      const date = rawDate ? new Date(rawDate) : null;
      const dateStr = date && !Number.isNaN(date.getTime())
        ? date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'Data indisponivel';

      const ndvi = Number(item.NDVI_VALOR !== undefined ? item.NDVI_VALOR : item.ndvi_valor);
      const lat = Number(item.LATITUDE !== undefined ? item.LATITUDE : item.latitude);
      const lon = Number(item.LONGITUDE !== undefined ? item.LONGITUDE : item.longitude);
      const classification = item.CLASSIFICACAO_NDVI || item.classificacao_ndvi || 'NDVI';

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(ndvi)) {
        return '';
      }

      // Definir cor baseada no score
      let color = '#84cc16'; // Moderado
      if (ndvi >= 0.6) color = '#10b981'; // Densa
      else if (ndvi < 0.4 && ndvi >= 0.2) color = '#eab308'; // Esparsa
      else if (ndvi < 0.2) color = '#f97316'; // Solo exposto

      return `
        <div class="history-item" onclick="App.handleLocationSelect(${lat}, ${lon})">
          <div class="history-item__left">
            <div class="history-item__title">📍 Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</div>
            <div class="history-item__meta">${dateStr} • ${classification}</div>
          </div>
          <span class="history-item__badge" style="background: ${color}1a; color: ${color}; border: 1px solid ${color}33">
            NDVI: ${ndvi.toFixed(2)}
          </span>
        </div>
      `;
    }).join('');

    container.innerHTML = html || `
      <div class="history__empty">
        <p>Historico encontrado, mas sem dados suficientes para exibicao.</p>
      </div>
    `;
  }

  /**
   * Mostra mensagem de feedback temporária
   */
  function showFeedback(text, type) {
    const feedback = document.getElementById('iotFeedback');
    if (!feedback) return;

    feedback.textContent = text;
    feedback.style.display = 'block';
    feedback.className = `iot-feedback iot-feedback--${type}`;

    setTimeout(() => {
      feedback.style.display = 'none';
    }, 4000);
  }

  /**
   * Retorna as leituras simuladas atuais
   */
  function getCurrentReadings() {
    return latestReadings;
  }

  return {
    init,
    loadHistory,
    getCurrentReadings
  };
})();

// Inicializar módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', IotModule.init);
