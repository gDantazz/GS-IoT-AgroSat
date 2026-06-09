/**
 * Rotas de IA - Chat com Gemini
 */

import { Router } from 'express';
import { chat, generateAnalysis } from '../services/geminiService.js';
import { saveChatLog } from '../services/dbService.js';

const router = Router();

/**
 * POST /api/ai/chat
 * Envia mensagem para o assistente IA com contexto agrícola
 * Body: { message, location, climateData, ndviData, events }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, location, climateData, ndviData, events, sensorData, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Campo "message" é obrigatório' });
    }

    const context = { location, climateData, ndviData, events, sensorData };
    const response = await chat(message, context, history);

    // Salvar log da conversa no banco de dados de forma assíncrona
    saveChatLog(message, response).catch(err => console.error('Erro ao salvar chat no banco:', err));

    res.json({ response, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Erro no chat IA:', error.message);
    
    if (error.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ 
        error: 'API Key do Gemini não configurada',
        details: error.message 
      });
    }

    if (error.message.includes('high demand') || error.message.includes('503') || error.message.includes('UNAVAILABLE')) {
      return res.status(503).json({
        error: 'Serviço temporariamente indisponível',
        details: 'O serviço gratuito da API do Gemini está sob alta demanda no momento. Por favor, aguarde alguns segundos e tente enviar sua mensagem novamente.'
      });
    }

    res.status(500).json({ error: 'Erro ao processar mensagem com IA', details: error.message });
  }
});

/**
 * POST /api/ai/analyze
 * Gera análise automática de uma localização
 * Body: { location, climateData, ndviData, events }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { location, climateData, ndviData, events } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Campo "location" é obrigatório' });
    }

    const context = { location, climateData, ndviData, events };
    const analysis = await generateAnalysis(context);

    res.json({ analysis, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Erro na análise IA:', error.message);
    res.status(500).json({ error: 'Erro ao gerar análise', details: error.message });
  }
});

export default router;
