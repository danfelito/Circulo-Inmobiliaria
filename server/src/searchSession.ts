import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import type { SearchSnapshot } from './schemas.js';

const maxAgeMs = 2 * 60 * 60 * 1000;
const signature = (body: string) => createHmac('sha256', config.sessionSecret).update(`property-search-v1:${body}`).digest('base64url');

// The signed snapshot contains criteria and public listings only. It survives a
// Render restart without storing contact details or trusting client-edited URLs.
export function signSearch(snapshot: SearchSnapshot) {
  if (config.nodeEnv === 'production' && config.sessionSecret === 'development-only-secret-change-me') throw new Error('SESSION_SECRET debe estar configurada.');
  const body = Buffer.from(JSON.stringify(snapshot)).toString('base64url');
  return `${body}.${signature(body)}`;
}

export function readSearch(token: string, searchId: string, now = Date.now()): SearchSnapshot | null {
  if (token.length > 500_000) return null;
  const [body, supplied, extra] = token.split('.');
  if (!body || !supplied || extra) return null;
  const expected = signature(body);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const snapshot = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SearchSnapshot;
    const age = now - Date.parse(snapshot.createdAt);
    if (snapshot.searchId !== searchId || !Number.isFinite(age) || age < 0 || age > maxAgeMs) return null;
    return snapshot;
  } catch { return null; }
}
