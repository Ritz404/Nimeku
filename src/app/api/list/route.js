import { NextResponse } from 'next/server';
import { fetchOmnify, pickList, onlyAnime } from '@/lib/api';
import { parseCatalog, pageUrl } from '@/lib/catalog';
import { clientIp } from '@/lib/gate';
import { hit } from '@/lib/limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Halaman lanjutan untuk daftar anime/donghua (dipanggil saat daftar digulir sampai ujung).
// Alamat endpoint dibentuk di server dari parameter yang dikenal saja, bukan diteruskan dari pengunjung.
export async function GET(request) {
  if (!hit(`l:${clientIp(request.headers)}`, 45, 60_000)) return NextResponse.json({ items: [] }, { status: 429 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const c = parseCatalog(sp);
  const page = Math.min(400, Math.max(1, parseInt(sp.page, 10) || 1));
  const data = await fetchOmnify(pageUrl(c, page), c.q ? 0 : 300);
  if (data == null) return NextResponse.json({ items: [], error: true }, { status: 502 }); // gagal, bukan "habis"
  return NextResponse.json({ items: onlyAnime(pickList(data)) }, { headers: { 'Cache-Control': c.q ? 'no-store' : 'private, max-age=120' } });
}
