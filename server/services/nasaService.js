/**
 * NASA Data Service
 * Integra com NASA POWER API (dados climáticos agrícolas) e EONET API (desastres naturais)
 */

const NASA_POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const EONET_BASE = 'https://eonet.gsfc.nasa.gov/api/v3';

/**
 * Busca dados climáticos agrícolas do NASA POWER API
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} startDate - Data início (YYYYMMDD)
 * @param {string} endDate - Data fim (YYYYMMDD)
 * @returns {Object} Dados climáticos processados
 */
export async function getClimateData(lat, lon, startDate, endDate) {
  const params = new URLSearchParams({
    parameters: 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN',
    community: 'AG',
    longitude: lon.toString(),
    latitude: lat.toString(),
    start: startDate,
    end: endDate,
    format: 'JSON'
  });

  const url = `${NASA_POWER_BASE}?${params}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`NASA POWER API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Processar e estruturar os dados
  const properties = data.properties?.parameter || {};
  const dates = Object.keys(properties.T2M || {});
  
  const dailyData = dates.map(date => ({
    date,
    temperature: properties.T2M?.[date],
    tempMax: properties.T2M_MAX?.[date],
    tempMin: properties.T2M_MIN?.[date],
    precipitation: properties.PRECTOTCORR?.[date],
    humidity: properties.RH2M?.[date],
    solarRadiation: properties.ALLSKY_SFC_SW_DWN?.[date]
  })).filter(d => d.temperature !== -999); // Filtrar dados inválidos da NASA

  // Calcular médias do período
  const validData = dailyData.filter(d => 
    d.temperature !== null && d.temperature !== -999
  );

  const summary = {
    avgTemperature: average(validData.map(d => d.temperature)),
    avgTempMax: average(validData.map(d => d.tempMax)),
    avgTempMin: average(validData.map(d => d.tempMin)),
    totalPrecipitation: sum(validData.map(d => d.precipitation)),
    avgHumidity: average(validData.map(d => d.humidity)),
    avgSolarRadiation: average(validData.map(d => d.solarRadiation)),
    daysWithRain: validData.filter(d => d.precipitation > 0.1).length,
    daysWithoutRain: validData.filter(d => d.precipitation <= 0.1).length,
    period: { start: startDate, end: endDate, totalDays: validData.length }
  };

  return { daily: dailyData, summary, location: { lat, lon } };
}

/**
 * Busca eventos naturais do NASA EONET API
 * @param {string} category - Categoria do evento (ex: drought, wildfires, floods)
 * @param {number} days - Número de dias para buscar
 * @returns {Array} Lista de eventos
 */
export async function getNaturalEvents(category, days = 60) {
  const params = new URLSearchParams({
    status: 'open',
    limit: '50',
    days: days.toString()
  });
  
  if (category) {
    params.set('category', category);
  }

  const url = `${EONET_BASE}/events?${params}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`EONET API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Processar e simplificar os eventos
  const events = (data.events || []).map(event => ({
    id: event.id,
    title: event.title,
    category: event.categories?.[0]?.title || 'Desconhecido',
    categoryId: event.categories?.[0]?.id || 'unknown',
    date: event.geometry?.[0]?.date,
    coordinates: event.geometry?.[0]?.coordinates,
    magnitude: event.geometry?.[0]?.magnitudeValue,
    magnitudeUnit: event.geometry?.[0]?.magnitudeUnit,
    source: event.sources?.[0]?.url,
    closed: event.closed
  }));

  return events;
}

/**
 * Calcula estimativa de NDVI baseado em dados climáticos
 * Modelo simplificado que correlaciona precipitação, temperatura e radiação 
 * com saúde da vegetação
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Object} Estimativa NDVI com classificação
 */
export async function calculateNDVI(lat, lon) {
  // Buscar últimos 30 dias de dados climáticos
  const endDate = formatDate(new Date());
  const startDate = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  
  const climateData = await getClimateData(lat, lon, startDate, endDate);
  const { summary } = climateData;

  // Modelo simplificado de estimativa NDVI
  // Baseado em correlações climáticas com saúde da vegetação
  let ndviScore = 0;

  // Fator precipitação (0-0.3): mais chuva = vegetação mais saudável
  const precipFactor = Math.min(summary.totalPrecipitation / 150, 1) * 0.3;
  ndviScore += precipFactor;

  // Fator temperatura (0-0.25): faixa ideal 20-30°C
  const tempOptimal = 1 - Math.abs(summary.avgTemperature - 25) / 25;
  const tempFactor = Math.max(0, tempOptimal) * 0.25;
  ndviScore += tempFactor;

  // Fator umidade (0-0.25): mais umidade = melhor
  const humidityFactor = Math.min(summary.avgHumidity / 100, 1) * 0.25;
  ndviScore += humidityFactor;

  // Fator radiação solar (0-0.2): faixa ideal 15-25 MJ/m²/dia
  const radOptimal = 1 - Math.abs(summary.avgSolarRadiation - 20) / 20;
  const radFactor = Math.max(0, radOptimal) * 0.2;
  ndviScore += radFactor;

  // Normalizar para escala NDVI (-1 a 1), com bias positivo para regiões tropicais
  const ndvi = Math.round((ndviScore * 2 - 0.2) * 100) / 100;
  const clampedNdvi = Math.max(-1, Math.min(1, ndvi));

  // Classificação
  let classification, description, color;
  if (clampedNdvi >= 0.6) {
    classification = 'Vegetação Densa';
    description = 'Excelente cobertura vegetal. Condições muito favoráveis para agricultura.';
    color = '#10b981';
  } else if (clampedNdvi >= 0.4) {
    classification = 'Vegetação Moderada';
    description = 'Boa cobertura vegetal. Condições adequadas para a maioria das culturas.';
    color = '#84cc16';
  } else if (clampedNdvi >= 0.2) {
    classification = 'Vegetação Esparsa';
    description = 'Cobertura vegetal reduzida. Atenção ao manejo da irrigação e solo.';
    color = '#eab308';
  } else if (clampedNdvi >= 0) {
    classification = 'Solo Exposto / Vegetação Mínima';
    description = 'Pouca ou nenhuma vegetação. Risco de degradação do solo.';
    color = '#f97316';
  } else {
    classification = 'Água / Área Não-vegetada';
    description = 'Área sem vegetação. Pode indicar corpo d\'água ou solo completamente exposto.';
    color = '#ef4444';
  }

  return {
    ndvi: clampedNdvi,
    classification,
    description,
    color,
    factors: {
      precipitation: { value: summary.totalPrecipitation, score: precipFactor },
      temperature: { value: summary.avgTemperature, score: tempFactor },
      humidity: { value: summary.avgHumidity, score: humidityFactor },
      solarRadiation: { value: summary.avgSolarRadiation, score: radFactor }
    },
    climateContext: summary,
    location: { lat, lon }
  };
}

// --- Helpers ---

function average(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && v !== -999);
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}

function sum(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && v !== -999);
  return Math.round(valid.reduce((a, b) => a + b, 0) * 100) / 100;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
