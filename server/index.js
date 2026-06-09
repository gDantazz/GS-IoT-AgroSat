import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import nasaRoutes from './routes/nasa.js';
import aiRoutes from './routes/ai.js';
import iotRoutes from './routes/iot.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(join(__dirname, '..', 'public')));

// Rotas da API
app.use('/api/nasa', nasaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/iot', iotRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🌱 AgroSat Server rodando em http://localhost:${PORT}`);
  console.log(`📡 APIs disponíveis:`);
  console.log(`   GET  /api/nasa/climate?lat=&lon=&start=&end=`);
  console.log(`   GET  /api/nasa/events?category=&days=`);
  console.log(`   GET  /api/nasa/ndvi?lat=&lon=`);
  console.log(`   GET  /api/nasa/history`);
  console.log(`   POST /api/ai/chat`);
  console.log(`   POST /api/iot/readings`);
  console.log(`   GET  /api/iot/readings`);
  console.log(`   GET  /api/health\n`);
});
