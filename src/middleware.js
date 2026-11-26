import { NextResponse } from 'next/server';
import { COOKIE, checkToken, clientIp } from './lib/gate';

// Skrip/crawler umum. Browser asli tidak memakai UA seperti ini.
const SCRIPT_UA = /(curl|wget|python|aiohttp|httpx|scrapy|go-http|okhttp|java\/|libwww|axios|node-fetch|undici|headless|phantom|selenium|puppeteer|playwright|googlebot|bingbot|baiduspider|yandex|ahrefs|semrush|mj12bot|petalbot|bytespider|gptbot|claudebot|ccbot|dotbot)/i;

// Gerbang Turnstile: pengunjung harus lolos verifikasi (berlaku 6 jam, terikat ke IP + perangkat)
// sebelum membuka situs atau memutar video.
export async function middleware(request) {
  // Aplikasi ini tidak punya server action. Permintaan dengan header ini berasal dari pemindai dan hanya memenuhi log dengan error.
  if (request.headers.has('next-action')) return new NextResponse(null, { status: 404 });

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return NextResponse.next(); // belum dikonfigurasi: gerbang mati

  const { pathname } = request.nextUrl;
  const h = request.headers;
  const ua = h.get('user-agent') || '';

  // Anti-hotlink: video/unduhan tidak boleh dipanggil dari situs lain
  if (pathname.startsWith('/api/stream') && h.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  if (await checkToken(secret, request.cookies.get(COOKIE)?.value, clientIp(h), ua)) return NextResponse.next();

  if (!ua || SCRIPT_UA.test(ua)) return new NextResponse('Akses ditolak', { status: 403 });
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Verifikasi diperlukan' }, { status: 403 });

  // Halaman verifikasi tampil di alamat yang sama (URL tidak berubah), seperti halaman tantangan Cloudflare
  const url = request.nextUrl.clone();
  url.pathname = '/verifikasi';
  url.search = '';
  return NextResponse.rewrite(url, { headers: { 'Cache-Control': 'no-store' } });
}

export const config = { matcher: ['/((?!_next/|favicon\\.ico|icon\\.svg|verifikasi|api/turnstile).*)'] };
