/**
 * Gemini AI Service
 * Integra com Google Gemini API para assistente agrícola inteligente
 */

import { GoogleGenAI } from '@google/genai';

let ai = null;

function getClient() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'sua_chave_aqui') {
      throw new Error(
        'GEMINI_API_KEY não configurada. Obtenha sua chave gratuita em https://aistudio.google.com e configure no arquivo .env'
      );
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

const SYSTEM_INSTRUCTION = `Você é o **AgroSat AI**, um assistente agrícola inteligente e especialista.

Seu papel:
- Analisar dados climáticos (temperatura, precipitação, umidade, radiação solar) de satélites da NASA
- Interpretar índices de vegetação (NDVI) e explicar o que significam para o agricultor
- Avaliar alertas de desastres naturais e seu impacto na agricultura
- Sugerir ações práticas e específicas para o manejo da lavoura

Regras:
1. Sempre responda em **português brasileiro**
2. Seja **claro, direto e prático** — o agricultor precisa de ações concretas
3. Use **dados fornecidos** no contexto para embasar suas respostas
4. Quando relevante, mencione **riscos** (seca, geada, excesso de chuva) e **oportunidades** (plantio, colheita, irrigação)
5. Formate suas respostas de maneira organizada, com tópicos e emojis quando apropriado
6. Se não tiver dados suficientes, peça ao agricultor para selecionar uma localização no mapa
7. Relacione suas análises com os **Objetivos de Desenvolvimento Sustentável (ODS 2 — Fome Zero)**
8. Mantenha respostas concisas — máximo 3-4 parágrafos

Você tem acesso a dados reais de satélites da NASA (POWER API e EONET).`;

/**
 * Envia mensagem para o Gemini com contexto agrícola
 * @param {string} userMessage - Mensagem do agricultor
 * @param {Object} context - Dados de contexto (clima, NDVI, alertas, localização)
 * @returns {string} Resposta do Gemini
 */
export async function chat(userMessage, context = {}, history = []) {
  const client = getClient();

  // Montar contexto com dados reais
  let contextPrompt = '';

  if (context.location) {
    contextPrompt += `\n📍 **Localização do agricultor:** Lat ${context.location.lat}, Lon ${context.location.lon}\n`;
  }

  if (context.climateData?.summary) {
    const s = context.climateData.summary;
    contextPrompt += `\n🌡️ **Dados Climáticos (últimos ${s.period?.totalDays || 30} dias):**
- Temperatura média: ${s.avgTemperature}°C (Máx: ${s.avgTempMax}°C, Mín: ${s.avgTempMin}°C)
- Precipitação total: ${s.totalPrecipitation}mm
- Dias com chuva: ${s.daysWithRain} | Dias sem chuva: ${s.daysWithoutRain}
- Umidade média: ${s.avgHumidity}%
- Radiação solar média: ${s.avgSolarRadiation} MJ/m²/dia\n`;
  }

  if (context.ndviData) {
    contextPrompt += `\n🌿 **Índice de Vegetação (NDVI estimado):**
- Valor: ${context.ndviData.ndvi}
- Classificação: ${context.ndviData.classification}
- ${context.ndviData.description}\n`;
  }

  if (context.events && context.events.length > 0) {
    contextPrompt += `\n⚠️ **Alertas de Desastres Naturais Ativos (${context.events.length} eventos):**\n`;
    context.events.slice(0, 5).forEach(event => {
      contextPrompt += `- ${event.category}: ${event.title} (${event.date?.split('T')[0] || 'N/A'})\n`;
    });
  }

  if (context.sensorData) {
    contextPrompt += `\n🔌 **Telemetria de Sensores IoT Locais (Tempo Real):**
- Umidade do solo: ${context.sensorData.umidade_solo}%
- Temperatura do ar local: ${context.sensorData.temperatura_ar}°C
- pH do solo: ${context.sensorData.ph_solo}\n`;
  }

  const fullPrompt = contextPrompt
    ? `[CONTEXTO DOS DADOS DE SATÉLITE]\n${contextPrompt}\n\n[PERGUNTA DO AGRICULTOR]\n${userMessage}`
    : userMessage;

  // Montar o histórico de mensagens formatado para o Gemini API
  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    history.forEach(msg => {
      contents.push({
        role: msg.role, // 'user' ou 'model'
        parts: [{ text: msg.content }]
      });
    });
  }

  // Adicionar a mensagem atual com o contexto correspondente
  contents.push({
    role: 'user',
    parts: [{ text: fullPrompt }]
  });

  const maxRetries = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      });
      return response.text;
    } catch (error) {
      attempt++;
      lastError = error;
      console.warn(`[Gemini] Tentativa ${attempt} falhou: ${error.message}`);
      
      if (attempt < maxRetries) {
        // Aguarda (1s, 2s) antes de tentar novamente
        const delay = attempt * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Gera análise automática de uma localização
 * @param {Object} context - Dados completos da localização
 * @returns {string} Análise gerada pelo Gemini
 */
export async function generateAnalysis(context) {
  const prompt = `Faça uma análise completa e breve da situação agrícola desta localização baseando-se nos dados de satélite fornecidos. 
Inclua:
1. Condições climáticas atuais e tendências
2. Interpretação do NDVI
3. Riscos identificados
4. Recomendações práticas para o agricultor`;

  return chat(prompt, context);
}
