import type { ApiError as ApiErrorBody } from '@shared/api';

/** Ошибка API в формате { error: { code, message, fields? } }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown',
      err?.message ?? 'Что-то пошло не так',
      err?.fields,
    );
  }
  return data as T;
}

/** Текст ошибки для формы: поле → сообщение, плюс общее сообщение без поля. */
export function formErrors(err: unknown): { fields: Record<string, string>; general: string | null } {
  if (err instanceof ApiError) {
    const hasFields = Object.keys(err.fields).length > 0;
    return { fields: err.fields, general: hasFields ? null : err.message };
  }
  return { fields: {}, general: err ? 'Что-то пошло не так' : null };
}
