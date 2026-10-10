import type { ErrorRequestHandler, Response } from 'express';
import { ZodError, type ZodType, type z } from 'zod';

/** Ошибка, которая уходит клиенту как { error: { code, message, fields? } }. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Запись') => new AppError(404, 'not_found', `${what} не найдена`);

/** Разбирает вход по схеме zod. Ошибки превращаются в 400 с текстами по полям. */
export function parse<S extends ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw zodToAppError(result.error);
}

function zodToAppError(err: ZodError): AppError {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return new AppError(400, 'validation', 'Проверь поля формы', fields);
}

/** userId, положенный в res.locals middleware авторизации. */
export function userIdOf(res: Response): number {
  const id = res.locals.userId as number | undefined;
  if (!id) throw new AppError(401, 'unauthorized', 'Нужно войти');
  return id;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next;
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fields && { fields: err.fields }) },
    });
    return;
  }
  if (err instanceof ZodError) {
    const e = zodToAppError(err);
    res.status(400).json({ error: { code: e.code, message: e.message, fields: e.fields } });
    return;
  }
  // Битый JSON в теле запроса от express.json().
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'bad_json', message: 'Тело запроса не JSON' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal', message: 'Что-то сломалось на сервере' } });
};
