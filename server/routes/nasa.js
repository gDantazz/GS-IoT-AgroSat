/**
 * Rotas da NASA - Climate Data + Natural Events + NDVI
 */

import { Router } from 'express';
import { getClimateData, getNaturalEvents, calculateNDVI } from '../services/nasaService.js';
import { saveSearch, getSearchHistory } from '../services/dbService.js';

const router = Router();

/**
 * GET /api/nasa/climate
 * Busca dados climáticos do NASA POWER API
 * Query params: lat, lon, start (YYYYMMDD), end (YYYYMMDD)
 */
router.get('/climate', async (req, res) => {
  try {
    const { lat, lon, start, end } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Parâmetros lat e lon são obrigatórios' });
    }

    // Padrão: últimos 30 dias
    const endDate = end || formatDate(new Date());
    const startDate = start || formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const data = await getClimateData(parseFloat(lat), parseFloat(lon), startDate, endDate);
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados climáticos:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados climáticos da NASA', details: error.message });
  }
});

/**
 * GET /api/nasa/events
 * Busca eventos naturais do NASA EONET API
 * Query params: category (opcional), days (opcional, padrão 60)
 */
router.get('/events', async (req, res) => {
  try {
    const { category, days } = req.query;
    const events = await getNaturalEvents(category, parseInt(days) || 60);
    res.json({ events, total: events.length });
  } catch (error) {
    console.error('Erro ao buscar eventos naturais:', error.message);
    res.status(500).json({ error: 'Erro ao buscar eventos naturais da NASA', details: error.message });
  }
});

/**
 * GET /api/nasa/ndvi
 * Calcula estimativa de NDVI baseado em dados climáticos
 * Query params: lat, lon
 */
router.get('/ndvi', async (req, res) => {
  try {
    const { lat, lon, save } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Parâmetros lat e lon são obrigatórios' });
    }

    const ndviData = await calculateNDVI(parseFloat(lat), parseFloat(lon));
    
    if (save === 'true') {
      // Salvar busca no banco de dados somente quando o frontend pedir persistencia.
      await saveSearch({
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        temp_media: ndviData.climateContext?.avgTemperature,
        temp_max: ndviData.climateContext?.avgTempMax,
        temp_min: ndviData.climateContext?.avgTempMin,
        precip_total: ndviData.climateContext?.totalPrecipitation,
        umidade_media: ndviData.climateContext?.avgHumidity,
        rad_solar_media: ndviData.climateContext?.avgSolarRadiation,
        ndvi_valor: ndviData.ndvi,
        classificacao_ndvi: ndviData.classification
      });
    }

    res.json(ndviData);
  } catch (error) {
    console.error('Erro ao calcular NDVI:', error.message);
    res.status(500).json({ error: 'Erro ao calcular NDVI', details: error.message });
  }
});

/**
 * GET /api/nasa/history
 * Retorna o histórico das últimas buscas salvas no banco
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await getSearchHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('Erro ao recuperar histórico:', error.message);
    res.status(500).json({ error: 'Erro ao carregar histórico de buscas', details: error.message });
  }
});

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export default router;
