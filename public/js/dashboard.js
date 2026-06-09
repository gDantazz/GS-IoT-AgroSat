/**
 * Dashboard Module
 * Gerencia os cards de métricas e busca dados da NASA POWER API
 */

const Dashboard = (() => {
  let currentData = null;
  let ndviData = null;

  /**
   * Carrega dados climáticos para uma localização
   */
  async function loadClimateData(lat, lon) {
    try {
      const endDate = formatDate(new Date());
      const startDate = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const response = await fetch(
        `/api/nasa/climate?lat=${lat}&lon=${lon}&start=${startDate}&end=${endDate}`
      );

      if (!response.ok) throw new Error('Falha ao buscar dados climáticos');

      currentData = await response.json();
      updateCards(currentData.summary);

      return currentData;
    } catch (error) {
      console.error('Dashboard: erro ao carregar dados climáticos:', error);
      showError('Não foi possível carregar dados climáticos');
      return null;
    }
  }

  /**
   * Carrega dados de NDVI para uma localização
   */
  async function loadNDVI(lat, lon, options = {}) {
    try {
      const shouldSave = options.persist === true;
      const response = await fetch(`/api/nasa/ndvi?lat=${lat}&lon=${lon}&save=${shouldSave}`);

      if (!response.ok) throw new Error('Falha ao calcular NDVI');

      ndviData = await response.json();
      updateNDVICard(ndviData);

      return ndviData;
    } catch (error) {
      console.error('Dashboard: erro ao calcular NDVI:', error);
      return null;
    }
  }

  /**
   * Atualiza os cards com dados do sumário
   */
  function updateCards(summary) {
    if (!summary) return;

    // Temperatura
    animateValue('tempValue', `${summary.avgTemperature}°C`);
    document.getElementById('tempDetail').textContent =
      `Máx: ${summary.avgTempMax}°C | Mín: ${summary.avgTempMin}°C`;

    // Precipitação
    animateValue('rainValue', `${summary.totalPrecipitation} mm`);
    document.getElementById('rainDetail').textContent =
      `${summary.daysWithRain} dias com chuva`;

    // Umidade
    animateValue('humidityValue', `${summary.avgHumidity}%`);
    document.getElementById('humidityDetail').textContent = 'Média do período';

    // Radiação Solar
    animateValue('solarValue', `${summary.avgSolarRadiation} MJ/m²`);
    document.getElementById('solarDetail').textContent = 'Média diária';
  }

  /**
   * Atualiza o card de NDVI
   */
  function updateNDVICard(data) {
    if (!data) return;

    const valueEl = document.getElementById('ndviValue');
    const detailEl = document.getElementById('ndviDetail');
    const fillEl = document.getElementById('ndviFill');

    animateValue('ndviValue', data.ndvi.toFixed(2));
    detailEl.textContent = data.classification;
    detailEl.style.color = data.color;

    // Atualizar barra de progresso (NDVI vai de -1 a 1, normalizar para 0-100%)
    const percentage = ((data.ndvi + 1) / 2) * 100;
    setTimeout(() => {
      fillEl.style.width = `${percentage}%`;
      fillEl.style.background = data.color;
    }, 300);

    // Mudar cor do valor
    valueEl.style.color = data.color;
  }

  /**
   * Animação de transição do valor
   */
  function animateValue(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';

    setTimeout(() => {
      el.textContent = newValue;
      el.style.transition = 'all 0.4s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 150);
  }

  /**
   * Mostra erro nos cards
   */
  function showError(msg) {
    ['tempValue', 'rainValue', 'humidityValue', 'solarValue', 'ndviValue'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '--';
    });
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  function getData() { return currentData; }
  function getNDVI() { return ndviData; }

  return {
    loadClimateData,
    loadNDVI,
    getData,
    getNDVI
  };
})();
