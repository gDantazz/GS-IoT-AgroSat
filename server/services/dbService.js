/**
 * Oracle Database Service
 * Gerencia a conexão com o Oracle DB em modo Thin e realiza as operações CRUD com fallback em memória.
 */

import oracledb from 'oracledb';

// Configurar o driver para retornar resultados como objetos e comitar automaticamente
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

// Fallbacks em memória caso a conexão com o banco falhe ou não esteja configurada
const fallbacks = {
  buscas: [],
  sensores: [
    // Algumas leituras mockadas para inicializar o dashboard com dados interessantes
    {
      id: 1,
      latitude: -23.55,
      longitude: -46.63,
      umidade_solo: 62.5,
      temperatura_ar: 23.8,
      ph_solo: 6.2,
      data_leitura: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
      id: 2,
      latitude: -23.55,
      longitude: -46.63,
      umidade_solo: 58.1,
      temperatura_ar: 24.2,
      ph_solo: 6.3,
      data_leitura: new Date().toISOString()
    }
  ],
  chat: []
};

/**
 * Obtém uma conexão ativa com o Oracle Database
 */
async function getConnection() {
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || 'oracle.fiap.com.br';
  const port = process.env.DB_PORT || '1521';
  const sid = process.env.DB_SID || 'orcl';

  if (!user || !password || password === 'sua_senha_do_banco_aqui') {
    throw new Error('Credenciais do banco de dados Oracle não configuradas no arquivo .env.');
  }

  // Conexão direta usando string de conexão clássica (Thin mode ativo por padrão no v6+)
  return await oracledb.getConnection({
    user,
    password,
    connectString: `${host}:${port}/${sid}`
  });
}

/**
 * Salva uma busca de satélite no histórico
 */
export async function saveSearch(data) {
  let conn;
  try {
    conn = await getConnection();
    const query = `
      INSERT INTO TB_AGRO_BUSCA 
      (latitude, longitude, temp_media, temp_max, temp_min, precip_total, umidade_media, rad_solar_media, ndvi_valor, classificacao_ndvi)
      VALUES (:latitude, :longitude, :temp_media, :temp_max, :temp_min, :precip_total, :umidade_media, :rad_solar_media, :ndvi_valor, :classificacao_ndvi)
    `;
    
    await conn.execute(query, {
      latitude: data.latitude,
      longitude: data.longitude,
      temp_media: data.temp_media,
      temp_max: data.temp_max,
      temp_min: data.temp_min,
      precip_total: data.precip_total,
      umidade_media: data.umidade_media,
      rad_solar_media: data.rad_solar_media,
      ndvi_valor: data.ndvi_valor,
      classificacao_ndvi: data.classificacao_ndvi
    });
    
    console.log('[DB] Busca salva com sucesso no Oracle Database.');
  } catch (err) {
    console.warn('[DB Fallback] Erro ao salvar busca no Oracle. Salvando em memória local:', err.message);
    
    // Adicionar em memória local
    fallbacks.buscas.unshift({
      id: Date.now(),
      latitude: data.latitude,
      longitude: data.longitude,
      temp_media: data.temp_media,
      temp_max: data.temp_max,
      temp_min: data.temp_min,
      precip_total: data.precip_total,
      umidade_media: data.umidade_media,
      rad_solar_media: data.rad_solar_media,
      ndvi_valor: data.ndvi_valor,
      classificacao_ndvi: data.classificacao_ndvi,
      data_busca: new Date().toISOString()
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { console.error(e); }
    }
  }
}

/**
 * Retorna o histórico das últimas buscas realizadas
 */
export async function getSearchHistory(limit = 10) {
  let conn;
  try {
    conn = await getConnection();
    const query = `
      SELECT id, latitude, longitude, temp_media, temp_max, temp_min, 
             precip_total, umidade_media, rad_solar_media, ndvi_valor, 
             classificacao_ndvi, TO_CHAR(data_busca, 'YYYY-MM-DD"T"HH24:MI:SS') as data_busca
      FROM TB_AGRO_BUSCA 
      ORDER BY data_busca DESC
      FETCH FIRST :lim ROWS ONLY
    `;
    const result = await conn.execute(query, { lim: limit });
    return result.rows;
  } catch (err) {
    console.warn('[DB Fallback] Erro ao carregar histórico do Oracle. Retornando da memória local:', err.message);
    return fallbacks.buscas.slice(0, limit);
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { console.error(e); }
    }
  }
}

/**
 * Salva leitura de telemetria dos sensores IoT
 */
export async function saveSensorReading(data) {
  let conn;
  try {
    conn = await getConnection();
    const query = `
      INSERT INTO TB_AGRO_SENSOR_IOT 
      (latitude, longitude, umidade_solo, temperatura_ar, ph_solo)
      VALUES (:latitude, :longitude, :umidade_solo, :temperatura_ar, :ph_solo)
    `;
    
    await conn.execute(query, {
      latitude: data.latitude,
      longitude: data.longitude,
      umidade_solo: data.umidade_solo,
      temperatura_ar: data.temperatura_ar,
      ph_solo: data.ph_solo || null
    });
    
    console.log('[DB] Telemetria de sensor IoT salva com sucesso no Oracle Database.');
    return { storage: 'oracle' };
  } catch (err) {
    console.warn('[DB Fallback] Erro ao salvar leitura de sensor no Oracle. Salvando em memória local:', err.message);
    
    fallbacks.sensores.unshift({
      id: Date.now(),
      latitude: data.latitude,
      longitude: data.longitude,
      umidade_solo: data.umidade_solo,
      temperatura_ar: data.temperatura_ar,
      ph_solo: data.ph_solo || null,
      data_leitura: new Date().toISOString()
    });
    return { storage: 'memory', reason: err.message };
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { console.error(e); }
    }
  }
}

/**
 * Retorna as últimas leituras de sensores registradas
 */
export async function getSensorReadings(limit = 20) {
  let conn;
  try {
    conn = await getConnection();
    const query = `
      SELECT id, latitude, longitude, umidade_solo, temperatura_ar, ph_solo,
             TO_CHAR(data_leitura, 'YYYY-MM-DD"T"HH24:MI:SS') as data_leitura
      FROM TB_AGRO_SENSOR_IOT
      ORDER BY data_leitura DESC
      FETCH FIRST :lim ROWS ONLY
    `;
    const result = await conn.execute(query, { lim: limit });
    return result.rows;
  } catch (err) {
    console.warn('[DB Fallback] Erro ao carregar sensores do Oracle. Retornando da memória local:', err.message);
    return fallbacks.sensores.slice(0, limit);
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { console.error(e); }
    }
  }
}

/**
 * Salva log de conversação com o assistente IA
 */
export async function saveChatLog(userMsg, aiResp) {
  let conn;
  try {
    conn = await getConnection();
    const query = `
      INSERT INTO TB_AGRO_CHAT 
      (mensagem_user, resposta_ia)
      VALUES (:user_msg, :ai_resp)
    `;
    
    await conn.execute(query, {
      user_msg: userMsg,
      ai_resp: aiResp
    });
    
    console.log('[DB] Conversa salva no banco de dados Oracle.');
  } catch (err) {
    console.warn('[DB Fallback] Erro ao salvar chat no Oracle. Salvando em memória local:', err.message);
    
    fallbacks.chat.push({
      id: Date.now(),
      mensagem_user: userMsg,
      resposta_ia: aiResp,
      data_chat: new Date().toISOString()
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { console.error(e); }
    }
  }
}
