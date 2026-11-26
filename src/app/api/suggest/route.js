import { NextResponse } from 'next/server';
import { fetchOmnify, pickList, normalizeItem } from '@/lib/api';
import { clientIp } from '@/lib/gate';
import { hit } from '@/lib/limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Saran judul saat mengetik di kotak cari
export async function GET(request) {
  if (!hit(`g:${clientIp(request.headers)}`, 60, 60_000)) return NextResponse.json({ items: [] }, { status: 429 });
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const data = await fetchOmnify(`/anime/suggest?q=${encodeURIComponent(q)}`, 60);
  const items = pickList(data).slice(0, 8).map((x) => {
    if (typeof x === 'string') return { title: x, slug: '', poster: '' };
    const n = normalizeItem(x);
    return { title: n.title, slug: n.slug, poster: n.poster };
  }).filter((x) => x.title);
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
