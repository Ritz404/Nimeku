import { NextResponse } from 'next/server';
import { COOKIE, clientIp, makeToken, TTL_MS } from '@/lib/gate';
import { hit } from '@/lib/limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const first = (v) => (v || '').split(',')[0].trim();

// Ray ID Cloudflare untuk ditampilkan di halaman verifikasi
export async function GET(request) {
  return NextResponse.json({ ray: (request.headers.get('cf-ray') || '').split('-')[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

// Token dari widget dicek ke Cloudflare memakai kunci rahasia (hanya ada di server)
export async function POST(request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return NextResponse.json({ ok: true });

  const ip = clientIp(request.headers);
  const ua = request.headers.get('user-agent') || '';
  // Batasi percobaan per IP: bot yang menembak terus-menerus akan diblokir sementara
  if (!hit(`v:${ip}`, 8, 60_000)) return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan' }, { status: 429, headers: { 'Retry-After': '60' } });

  const { token } = await request.json().catch(() => ({}));
  if (!token || typeof token !== 'string' || token.length > 4096) return NextResponse.json({ ok: false }, { status: 400 });

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(10000) }).catch(() => null);
  const j = await r?.json().catch(() => null);

  // Selain "success", pastikan token dibuat di situs ini dan untuk gerbang ini (bukan token dari situs/aksi lain)
  const host = first(request.headers.get('x-forwarded-host') || request.headers.get('host')).split(':')[0];
  const hostOk = !j?.hostname || !host || /^(localhost|\d+\.\d+\.\d+\.\d+)$/.test(host) || j.hostname === host;
  const actionOk = (j?.action || '') === 'gate';
  if (!j?.success || !hostOk || !actionOk) {
    console.warn('[Turnstile] ditolak:', (j?.['error-codes'] || []).join(', ') || `hostname=${j?.hostname} action=${j?.action}`);
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(secret, ip, ua), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: TTL_MS / 1000,
    secure: first(request.headers.get('x-forwarded-proto')) === 'https',
  });
  return res;
}
