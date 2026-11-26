import { fetchOmnify, collectAnime } from '@/lib/api';

export const dynamic = 'force-dynamic';

// /acak -> loncat ke satu anime acak (redirect relatif agar aman di belakang domain/proxy)
export async function GET() {
  const list = collectAnime(await fetchOmnify('/anime/random?limit=10'));
  const pick = list[Math.floor(Math.random() * list.length)];
  const id = pick?.id || pick?.slug;
  return new Response(null, { status: 307, headers: { Location: id ? `/anime/${encodeURIComponent(id)}` : '/jelajah', 'Cache-Control': 'no-store' } });
}
