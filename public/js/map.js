/**
 * Map Module
 * Mapa interativo Leaflet com eventos naturais do EONET
 */

const MapModule = (() => {
  let map = null;
  let userMarker = null;
  let eventMarkers = [];
  let eventsData = [];

  const CATEGORY_CONFIG = {
    drought: { emoji: '🏜️', label: 'Seca', cssClass: 'drought' },
    wildfires: { emoji: '🔥', label: 'Incêndio', cssClass: 'wildfires' },
    floods: { emoji: '🌊', label: 'Inundação', cssClass: 'floods' },
    severeStorms: { emoji: '⛈️', label: 'Tempestade', cssClass: 'severeStorms' },
    volcanoes: { emoji: '🌋', label: 'Vulcão', cssClass: 'volcano' },
    earthquakes: { emoji: '🫨', label: 'Terremoto', cssClass: 'default' },
    landslides: { emoji: '⛰️', label: 'Deslizamento', cssClass: 'default' },
    snow: { emoji: '❄️', label: 'Neve', cssClass: 'default' },
    seaLakeIce: { emoji: '🧊', label: 'Gelo', cssClass: 'default' },
    tempExtremes: { emoji: '🌡️', label: 'Temp. Extrema', cssClass: 'default' },
    default: { emoji: '⚠️', label: 'Evento', cssClass: 'default' }
  };

  /**
   * Inicializa o mapa Leaflet
   */
  function init(containerId, options = {}) {
    const defaultLat = options.lat || -15.78;
    const defaultLon = options.lon || -47.93;
    const defaultZoom = options.zoom || 4;

    map = L.map(containerId, {
      zoomControl: true,
      attributionControl: true
    }).setView([defaultLat, defaultLon], defaultZoom);

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a> | NASA EONET',
      maxZoom: 19
    }).addTo(map);

    // Click no mapa para selecionar localização
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (options.onLocationSelect) {
        options.onLocationSelect(lat, lng, { persist: true });
      }
    });

    return map;
  }

  /**
   * Define marcador do usuário
   */
  function setUserLocation(lat, lon) {
    if (userMarker) {
      map.removeLayer(userMarker);
    }

    const icon = L.divIcon({
      html: `<div style="
        width: 20px; height: 20px;
        background: #10b981;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(16,185,129,0.6), 0 2px 8px rgba(0,0,0,0.3);
        animation: pulse-marker 2s ease-in-out infinite;
      "></div>
      <style>
        @keyframes pulse-marker {
          0%, 100% { box-shadow: 0 0 12px rgba(16,185,129,0.6); }
          50% { box-shadow: 0 0 24px rgba(16,185,129,0.9); }
        }
      </style>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    userMarker = L.marker([lat, lon], { icon })
      .addTo(map)
      .bindPopup(`
        <div class="map-popup__title">📍 Sua Localização</div>
        <div class="map-popup__date">Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</div>
      `);

    map.setView([lat, lon], 6);
  }

  /**
   * Carrega e exibe eventos naturais no mapa
   */
  async function loadEvents(days = 60) {
    try {
      const response = await fetch(`/api/nasa/events?days=${days}`);
      if (!response.ok) throw new Error('Falha ao buscar eventos');

      const data = await response.json();
      eventsData = data.events || [];

      // Limpar marcadores antigos
      eventMarkers.forEach(m => map.removeLayer(m));
      eventMarkers = [];

      // Adicionar novos marcadores
      eventsData.forEach(event => {
        if (!event.coordinates) return;

        const [lon, lat] = event.coordinates;
        const config = CATEGORY_CONFIG[event.categoryId] || CATEGORY_CONFIG.default;

        const icon = L.divIcon({
          html: `<div class="map-marker map-marker--${config.cssClass}">${config.emoji}</div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([lat, lon], { icon })
          .addTo(map)
          .bindPopup(`
            <div class="map-popup__category">${config.emoji} ${config.label}</div>
            <div class="map-popup__title">${event.title}</div>
            <div class="map-popup__date">📅 ${event.date ? new Date(event.date).toLocaleDateString('pt-BR') : 'N/A'}</div>
            ${event.magnitude ? `<div class="map-popup__date">📏 ${event.magnitude} ${event.magnitudeUnit || ''}</div>` : ''}
          `);

        eventMarkers.push(marker);
      });

      // Atualizar badge de alertas
      const badge = document.getElementById('eventsBadge');
      if (badge) {
        badge.textContent = `${eventsData.length} alertas`;
      }

      return eventsData;
    } catch (error) {
      console.error('Map: erro ao carregar eventos:', error);
      return [];
    }
  }

  /**
   * Renderiza lista de alertas no painel lateral
   */
  function renderAlertsList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (eventsData.length === 0) {
      container.innerHTML = `
        <div class="alerts__empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <p>Nenhum alerta de desastre ativo na região</p>
        </div>
      `;
      return;
    }

    container.innerHTML = eventsData.slice(0, 15).map(event => {
      const config = CATEGORY_CONFIG[event.categoryId] || CATEGORY_CONFIG.default;
      const dateStr = event.date ? new Date(event.date).toLocaleDateString('pt-BR') : 'N/A';

      return `
        <div class="alert-item alert-item--${event.categoryId}">
          <span class="alert-item__icon">${config.emoji}</span>
          <div class="alert-item__content">
            <div class="alert-item__title">${event.title}</div>
            <div class="alert-item__meta">${config.label} • ${dateStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getEvents() { return eventsData; }
  function getMap() { return map; }

  return {
    init,
    setUserLocation,
    loadEvents,
    renderAlertsList,
    getEvents,
    getMap
  };
})();
