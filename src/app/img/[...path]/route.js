import { API_BASE } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Meneruskan gambar/berkas dari server API tanpa memperlihatkan alamat aslinya.
// Gambar diberi cache panjang di browser, jadi poster yang sama tidak diunduh ulang tiap kali halaman dibuka.
export async function GET(request, { params }) {
  const { path } = await params;
  if (!Array.isArray(path) || path.some((s) => !s || s === '.' || s === '..')) return new Response('Not found', { status: 404 });
  const search = new URL(request.url).search;
  const target = `${API_BASE}/${path.map(encodeURIComponent).join('/')}${search}`;
  const range = request.headers.get('range');
  let up;
  try {
    up = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...(range && { Range: range }) },
      signal: AbortSignal.timeout(20000),
    });
  } catch { return new Response('Bad gateway', { status: 502 }); }

  const type = up.headers.get('content-type') || 'application/octet-stream';
  const headers = new Headers({ 'Content-Type': type });
  for (const k of ['content-length', 'content-range', 'accept-ranges', 'content-disposition']) {
    const v = up.headers.get(k);
    if (v) headers.set(k, v);
  }
  headers.set('Cache-Control', up.ok && type.startsWith('image/') ? 'public, max-age=604800, stale-while-revalidate=86400' : 'no-store');
  return new Response(up.body, { status: up.status, headers });
}
