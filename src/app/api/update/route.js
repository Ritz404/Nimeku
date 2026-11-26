import { NextResponse } from 'next/server';
import { fetchOmnify, buildEpisodes } from '@/lib/api';
import { clientIp } from '@/lib/gate';
import { hit } from '@/lib/limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Episode terbaru dari beberapa anime sekaligus (untuk notifikasi update). Data detail di-cache 10 menit di server,
// jadi banyak pengunjung yang memantau anime sama tidak membebani API.
export async function GET(request) {
  if (!hit(`u:${clientIp(request.headers)}`, 12, 60_000)) return NextResponse.json({ items: [] }, { status: 429 });
  const raw = new URL(request.url).searchParams.get('ids') || '';
  const ids = [...new Set(raw.split(',').map((x) => x.trim()).filter((x) => /^[\w.-]{1,120}$/.test(x)))].slice(0, 20);
  const items = await Promise.all(ids.map(async (id) => {
    const d = await fetchOmnify(`/anime/detail?id=${encodeURIComponent(id)}`, 600);
    if (!d || typeof d !== 'object') return null;
    // Sumber utama: nomor episode terbaru yang dilaporkan API. Daftar episode bisa memuat nomor yang belum tayang.
    const listed = buildEpisodes(d, id).filter((e) => e.listed);
    const top = listed.reduce((m, e) => (e.n > (m?.n || 0) ? e : m), null);
    const cur = Math.floor(Number(d.current_episode)) || 0;
    const latest = cur > 0 ? cur : top ? top.n : 0;
    if (!latest) return null;
    const idOf = listed.find((e) => e.n === latest)?.id || `${id}-ep-${latest}`;
    return { id, title: d.title || '', poster: d.poster || '', latest, latestId: idOf };
  }));
  return NextResponse.json({ items: items.filter(Boolean) }, { headers: { 'Cache-Control': 'no-store' } });
}
