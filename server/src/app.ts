import express, { Router } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { DB } from './db.js';
import { requireAuth } from './auth.js';
import { AppError, errorHandler } from './http.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { categoriesRouter } from './routes/categories.js';
import { transactionsRouter } from './routes/transactions.js';
import { dashboardRouter } from './routes/dashboard.js';
import { goalRouter } from './routes/goal.js';
import { petRouter } from './routes/pet.js';
import { checkinRouter } from './routes/checkin.js';
import { museumRouter } from './routes/museum.js';
import { subscriptionsRouter } from './routes/subscriptions.js';

export function createApp(db: DB) {
  const app = express();
  app.disable('x-powered-by');

  if (process.env.NODE_ENV !== 'production') {
    app.use(cors({ origin: /^http:\/\/localhost:\d+$/, credentials: true }));
  }
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use('/auth', authRouter(db));

  // Дальше только для вошедших.
  api.use(requireAuth(db));
  api.use('/profile', profileRouter(db));
  api.use('/dashboard', dashboardRouter(db));
  api.use('/transactions', transactionsRouter(db));
  api.use('/categories', categoriesRouter(db));
  api.use('/goal', goalRouter(db));
  api.use('/pet', petRouter(db));
  api.use('/checkin', checkinRouter(db));
  api.use('/museum', museumRouter(db));
  api.use('/subscriptions', subscriptionsRouter(db));

  api.use(() => {
    throw new AppError(404, 'not_found', 'Маршрут не найден');
  });

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
