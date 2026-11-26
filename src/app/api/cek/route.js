import { NextResponse } from 'next/server';
import { fetchOmnify, buildEpisodes } from '@/lib/api';
import { clientIp } from '@/lib/gate';
import { hit } from '@/lib/limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Jumlah episode terbaru untuk anime yang disimpan (dipakai halaman Simpanan).
// Data detail disimpan sementara 15 menit di server, jadi cek berulang tidak membebani API.
export async function GET(request) {
  if (!hit(`c:${clientIp(request.headers)}`, 20, 60_000)) return NextResponse.json({ latest: {} }, { status: 429 });
  const ids = (new URL(request.url).searchParams.get('ids') || '')
    .split(',').map((x) => x.trim()).filter((x) => /^[a-z0-9][a-z0-9-]{0,120}$/i.test(x)).slice(0, 12);
  const out = {};
  await Promise.all(ids.map(async (id) => {
    const detail = await fetchOmnify(`/anime/detail?id=${encodeURIComponent(id)}`, 900);
    if (detail) out[id] = buildEpisodes(detail, id).length;
  }));
  return NextResponse.json({ latest: out }, { headers: { 'Cache-Control': 'no-store' } });
}
