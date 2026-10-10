import jwt from 'jsonwebtoken';
import type { CookieOptions, RequestHandler } from 'express';
import type { DB } from './db.js';
import { AppError } from './http.js';
import { applyMissedDays } from './domain/care.js';

export const AUTH_COOKIE = 'kb_token';
const TOKEN_TTL_DAYS = 30;
const isProd = process.env.NODE_ENV === 'production';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (isProd) throw new Error('JWT_SECRET обязателен в production');
  return 'kubyshka-dev-secret-not-for-production';
}

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, secret(), { expiresIn: `${TOKEN_TTL_DAYS}d` });
}

function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, secret());
    const id = typeof payload === 'object' ? Number(payload.sub) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Пропускает только вошедших. Кладёт id в res.locals.userId. */
export function requireAuth(db: DB): RequestHandler {
  const exists = db.prepare('SELECT 1 FROM users WHERE id = ?');
  return (req, res, next) => {
    const token = (req.cookies as Record<string, string | undefined>)[AUTH_COOKIE];
    const userId = token ? verifyToken(token) : null;
    if (!userId || !exists.get(userId)) {
      throw new AppError(401, 'unauthorized', 'Нужно войти');
    }
    res.locals.userId = userId;
    applyMissedDays(db, userId);
    next();
  };
}
