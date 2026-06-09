/**
 * Rotas de IoT - Integração de Sensores e Telemetria
 */

import { Router } from 'express';
import { saveSensorReading, getSensorReadings } from '../services/dbService.js';

const router = Router();

/**
 * POST /api/iot/readings
 * Grava uma nova leitura de sensor IoT
 * Body: { latitude, longitude, umidade_solo, temperatura_ar, ph_solo }
 */
router.post('/readings', async (req, res) => {
  try {
    const { latitude, longitude, umidade_solo, temperatura_ar, ph_solo } = req.body;

    if (latitude === undefined || longitude === undefined || umidade_solo === undefined || temperatura_ar === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios: latitude, longitude, umidade_solo, temperatura_ar' });
    }

    const reading = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      umidade_solo: parseFloat(umidade_solo),
      temperatura_ar: parseFloat(temperatura_ar),
      ph_solo: ph_solo !== undefined ? parseFloat(ph_solo) : null
    };

    const persistence = await saveSensorReading(reading);
    res.status(201).json({ message: 'Leitura do sensor salva com sucesso!', reading, persistence });
  } catch (error) {
    console.error('Erro ao salvar telemetria IoT:', error.message);
    res.status(500).json({ error: 'Erro ao processar leitura do sensor IoT', details: error.message });
  }
});

/**
 * GET /api/iot/readings
 * Retorna as últimas leituras registradas
 */
router.get('/readings', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 15;
    const readings = await getSensorReadings(limit);
    res.json(readings);
  } catch (error) {
    console.error('Erro ao recuperar leituras de sensores:', error.message);
    res.status(500).json({ error: 'Erro ao carregar telemetria dos sensores', details: error.message });
  }
});

export default router;
