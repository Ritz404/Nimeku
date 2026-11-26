import { NextResponse } from 'next/server';
import { openUpstream, resolveStream } from '@/lib/streams';
import { clientIp } from '@/lib/gate';
import { hit } from '@/lib/limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Blokir alamat internal agar proxy tidak bisa dipakai mengintip jaringan server (SSRF)
const PRIVATE = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.(local|internal)$/i;

// Playlist HLS (.m3u8) berisi link relatif; tulis ulang agar semua segmen ikut lewat proxy
function rewritePlaylist(text, base) {
  const prox = (u) => `/api/stream?url=${encodeURIComponent(new URL(u, base).href)}`;
  return text
    .split('\n')
    .map((line) => {
      const l = line.trim();
      if (!l) return line;
      if (l.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${prox(u)}"`);
      return prox(l);
    })
    .join('\n');
}

export async function GET(request) {
  // Batasi per IP (cukup longgar untuk pemutaran, seek, dan segmen HLS) agar tidak bisa dipakai menyedot bandwidth
  if (!hit(`s:${clientIp(request.headers)}`, 240, 60_000)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan' }, { status: 429, headers: { 'Retry-After': '30' } });
  }
  const sp = new URL(request.url).searchParams;
  const ep = sp.get('ep');
  const isDownload = sp.get('download') === '1';
  const filename = (sp.get('filename') || 'nimeku.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
  const range = request.headers.get('range'); // wajib agar video bisa di-seek / lanjut
  const t0 = Date.now();
  // Pemutaran lewat episode: kalau server video tak menjawab 30 detik, menyerah supaya pemutar pindah ke server lain
  const open = (u) => openUpstream(u, { range, signal: request.signal, timeout: ep ? 30000 : 60000 });

  try {
    let target;
    let up;
    let fmt = '';
    if (ep) {
      const q = (sp.get('q') || '').toLowerCase();
      const s = Number(sp.get('s')) || 1;
      const f = (sp.get('f') || '').toLowerCase();
      let r = await resolveStream(ep, q, s, f);
      up = await open(r.url);
      // Link kedaluwarsa atau ditolak: minta link baru sekali lagi
      if ([401, 403, 404, 410].includes(up.status)) {
        r = await resolveStream(ep, q, s, f, true);
        up = await open(r.url);
      }
      target = r.url;
      fmt = r.format;
    } else {
      let parsed;
      try { parsed = new URL(sp.get('url')); } catch { return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 }); }
      if (!/^https?:$/.test(parsed.protocol) || PRIVATE.test(parsed.hostname)) {
        return NextResponse.json({ error: 'URL tidak diizinkan' }, { status: 400 });
      }
      target = parsed.href;
      up = await open(target);
    }
    if (!up.ok) {
      console.warn(`[stream] ${ep || 'url'} -> HTTP ${up.status}`);
      return NextResponse.json({ error: `Server asal menolak (${up.status})` }, { status: up.status });
    }
    if (Date.now() - t0 > 5000) console.warn(`[stream] ${ep || 'url'} lambat: ${Date.now() - t0} ms sampai respons awal`);

    const path = new URL(target).pathname;
    let type = up.headers.get('content-type') || 'video/mp4';
    if (/octet-stream/i.test(type) && /\.mp4/i.test(path)) type = 'video/mp4';

    // Link unduhan berupa halaman web (bukan file): arahkan ke halaman aslinya
    if (isDownload && /text\/html/i.test(type)) return NextResponse.redirect(target);

    // Playlist HLS: tulis ulang agar semua segmen lewat server ini
    if (fmt === 'hls' || /mpegurl/i.test(type) || /\.m3u8$/i.test(path)) {
      const text = await up.text();
      if (!text.trimStart().startsWith('#EXT')) return NextResponse.json({ error: 'Playlist tidak valid' }, { status: 502 });
      return new Response(rewritePlaylist(text, up.url), { headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' } });
    }

    // Halaman embed (iframe): diteruskan sebagai HTML, alamat relatif diarahkan ke server asal
    if (fmt === 'iframe' || /text\/html/i.test(type)) {
      let html = await up.text();
      const base = `<base href="${new URL(up.url).origin}/">`;
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${base}`) : `${base}${html}`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    const out = new Headers({ 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    // Content-Length hanya aman jika upstream tidak dikompresi, kalau tidak video terpotong
    if (!up.headers.get('content-encoding')) {
      const len = up.headers.get('content-length');
      if (len) out.set('Content-Length', len);
    }
    const cr = up.headers.get('content-range');
    if (cr) out.set('Content-Range', cr);
    if (isDownload) out.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new Response(up.body, { status: up.status, headers: out });
  } catch (err) {
    if (err.name === 'AbortError') return new Response(null, { status: 499 });
    console.warn(`[stream] ${ep || 'url'} gagal: ${err.message}`);
    return NextResponse.json({ error: 'Proxy gagal' }, { status: 502 });
  }
}
