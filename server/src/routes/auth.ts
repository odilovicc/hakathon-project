import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { DB } from '../db.js';
import { AUTH_COOKIE, cookieOptions, requireAuth, signToken } from '../auth.js';
import { AppError, parse, userIdOf } from '../http.js';
import { loadMe } from './mappers.js';

const BCRYPT_ROUNDS = 11;

const email = z
  .string({ required_error: 'Укажи email' })
  .trim()
  .toLowerCase()
  .email('Похоже, в email опечатка')
  .max(254);

const registerSchema = z.object({
  email,
  password: z
    .string({ required_error: 'Придумай пароль' })
    .min(8, 'Пароль от 8 символов')
    .max(128, 'Слишком длинный пароль'),
  name: z.string({ required_error: 'Как тебя зовут?' }).trim().min(1, 'Как тебя зовут?').max(40),
  currency: z.enum(['RUB', 'KZT', 'UZS', 'USD'], {
    errorMap: () => ({ message: 'Выбери валюту' }),
  }),
});

const loginSchema = z.object({
  email,
  password: z.string({ required_error: 'Введи пароль' }).min(1, 'Введи пароль').max(128),
});

export function authRouter(db: DB): Router {
  const r = Router();

  r.post('/register', async (req, res) => {
    const body = parse(registerSchema, req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) {
      throw new AppError(409, 'email_taken', 'Этот email уже занят', {
        email: 'Этот email уже занят',
      });
    }
    const hash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const userId = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO users (email, password_hash, name, currency) VALUES (?, ?, ?, ?)')
        .run(body.email, hash, body.name, body.currency);
      db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(lastInsertRowid);
      return Number(lastInsertRowid);
    })();
    res.cookie(AUTH_COOKIE, signToken(userId), cookieOptions);
    res.status(201).json(loadMe(db, userId));
  });

  r.post('/login', async (req, res) => {
    const body = parse(loginSchema, req.body);
    const row = db
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .get(body.email) as { id: number; password_hash: string } | undefined;
    // Сравниваем хеш даже для несуществующего email, чтобы время ответа не выдавало аккаунты.
    const ok = await bcrypt.compare(body.password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) {
      throw new AppError(401, 'invalid_credentials', 'Неверный email или пароль', {
        password: 'Неверный email или пароль',
      });
    }
    res.cookie(AUTH_COOKIE, signToken(row.id), cookieOptions);
    res.json(loadMe(db, row.id));
  });

  r.post('/logout', (_req, res) => {
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
    void _maxAge;
    res.clearCookie(AUTH_COOKIE, clearOptions);
    res.status(204).end();
  });

  r.get('/me', requireAuth(db), (_req, res) => {
    res.json(loadMe(db, userIdOf(res)));
  });

  return r;
}

const DUMMY_HASH = bcrypt.hashSync('kubyshka-timing-guard', 4);
