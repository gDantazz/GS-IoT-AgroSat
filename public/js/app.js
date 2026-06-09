/**
 * App Controller
 * Controlador principal do AgroSat — inicializa módulos e gerencia estado
 */

const App = (() => {
  let currentLocation = null;
  let isLoading = false;

  /**
   * Inicializa a aplicação
   */
  async function init() {
    console.log('🌱 AgroSat inicializando...');

    // Inicializar módulos
    Charts.init();
    Chat.init();

    // Inicializar mapa
    MapModule.init('map', {
      lat: -15.78,
      lon: -47.93,
      zoom: 4,
      onLocationSelect: handleLocationSelect
    });

    // Event listeners
    setupEventListeners();

    // Carregar eventos naturais globais
    try {
      await MapModule.loadEvents(60);
      MapModule.renderAlertsList('alertsList');
    } catch (e) {
      console.warn('Não foi possível carregar eventos:', e);
    }

    // Tentar geolocalização automática
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleLocationSelect(pos.coords.latitude, pos.coords.longitude, { persist: false });
        },
        () => {
          // Fallback: São Paulo
          handleLocationSelect(-23.55, -46.63, { persist: false });
        },
        { timeout: 5000 }
      );
    } else {
      handleLocationSelect(-23.55, -46.63, { persist: false });
    }
  }

  /**
   * Setup de event listeners
   */
  function setupEventListeners() {
    // Busca por coordenadas
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('locationInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });

    // Botão de geolocalização
    document.getElementById('geoBtn').addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => handleLocationSelect(pos.coords.latitude, pos.coords.longitude, { persist: true }),
          (err) => alert('Não foi possível obter sua localização. Verifique as permissões do navegador.'),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        alert('Geolocalização não é suportada por este navegador.');
      }
    });
  }

  /**
   * Lida com busca de coordenadas
   */
  function handleSearch() {
    const input = document.getElementById('locationInput').value.trim();
    if (!input) return;

    // Aceita formatos: "-23.55, -46.63" ou "-23.55 -46.63"
    const parts = input.split(/[,\s]+/).map(Number);

    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      handleLocationSelect(parts[0], parts[1], { persist: true });
    } else {
      alert('Formato inválido. Use: Latitude, Longitude (ex: -23.55, -46.63)');
    }
  }

  /**
   * Handler quando uma localização é selecionada
   */
  async function handleLocationSelect(lat, lon, options = {}) {
    if (isLoading) return;
    isLoading = true;

    // Arredondar coordenadas
    lat = Math.round(lat * 10000) / 10000;
    lon = Math.round(lon * 10000) / 10000;

    currentLocation = { lat, lon };

    // Atualizar UI
    document.getElementById('locationValue').textContent = `${lat}, ${lon}`;
    document.getElementById('locationInput').value = `${lat}, ${lon}`;

    // Mostrar loading
    showLoading();

    // Atualizar mapa
    MapModule.setUserLocation(lat, lon);

    try {
      // Carregar dados em paralelo
      const [climateData, ndviData] = await Promise.all([
        Dashboard.loadClimateData(lat, lon),
        Dashboard.loadNDVI(lat, lon, { persist: options.persist === true })
      ]);

      // Atualizar gráficos
      if (climateData) {
        Charts.setData(climateData);
      }

      // Notificar chat
      Chat.notifyLocationChange(lat, lon);

      // Atualizar lista de histórico de buscas no banco Oracle
      if (typeof IotModule !== 'undefined' && IotModule.loadHistory) {
        IotModule.loadHistory();
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      isLoading = false;
      hideLoading();
    }
  }

  /**
   * Mostra overlay de loading
   */
  function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('loading-overlay--hidden');
  }

  /**
   * Esconde overlay de loading
   */
  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('loading-overlay--hidden');
  }

  /**
   * Retorna localização atual
   */
  function getLocation() { return currentLocation; }

  return {
    init,
    getLocation,
    handleLocationSelect
  };
})();

// Iniciar quando o DOM carregar
document.addEventListener('DOMContentLoaded', App.init);
