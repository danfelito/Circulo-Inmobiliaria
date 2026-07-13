import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

function signature(payload: string) { return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url'); }
function safeEqual(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }

export async function validateAdminCredentials(login: string, password: string) {
  const accepted = [config.adminLogin, 'circulointernacionalveracruz1@gmail.com', 'circulointernacionalveracruz1'];
  if (!accepted.some((candidate) => candidate && safeEqual(login.trim().toLowerCase(), candidate.trim().toLowerCase()))) return false;
  if (config.adminPasswordHash) return bcrypt.compare(password, config.adminPasswordHash);
  if (!config.adminPassword) return false;
  return safeEqual(password, config.adminPassword);
}

export function issueAdminToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', login: config.adminLogin, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminToken(token?: string) {
  if (!token) return false;
  const [payload, supplied] = token.split('.');
  if (!payload || !supplied) return false;
  const expected = signature(payload); const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: string; login?: string; exp?: number }; return data.role === 'admin' && Number(data.exp) > Date.now(); }
  catch { return false; }
}