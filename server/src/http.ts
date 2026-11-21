import type { IncomingMessage, ServerResponse } from 'node:http';
import { db } from './db.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Ctx {
  req: IncomingMessage;
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: URLSearchParams;
}

type Handler = (ctx: Ctx) => unknown;
const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];

/** Registers a route; ":name" segments become params. */
export function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, pattern, keys, handler });
}

const MAX_BODY = 100_000;

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new HttpError(413, 'Request too large');
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.pattern);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const body = req.method === 'GET' ? {} : await readBody(req);
      return send(200, (await r.handler({ req, body, params, query: url.searchParams })) ?? { ok: true });
    }
    send(404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError) return send(err.status, { error: err.message });
    console.error(err);
    send(500, { error: 'Something went wrong' });
  }
}

/** Resolves the bearer token to a user or admin id, or throws 401. */
export function requireAuth(ctx: Ctx, kind: 'user' | 'admin'): number {
  const token = (ctx.req.headers.authorization ?? '').replace(/^Bearer /, '');
  const row = token
    ? db.prepare('SELECT subject_id FROM sessions WHERE token = ? AND kind = ? AND expires_at > ?').get(token, kind, Date.now()) as { subject_id: number } | undefined
    : undefined;
  if (!row) throw new HttpError(401, 'Please login again');
  return row.subject_id;
}

// ---------- input helpers ----------
export const str = (v: unknown, name: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} is required`);
  if (v.length > max) throw new HttpError(400, `${name} is too long`);
  return v.trim();
};
export const int = (v: unknown, name: string): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new HttpError(400, `${name} must be a whole number`);
  return n;
};
export const mobileOf = (v: unknown): string => {
  const m = str(v, 'Mobile number', 20).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(m)) throw new HttpError(400, 'Enter a valid 10-digit mobile number');
  return m;
};
