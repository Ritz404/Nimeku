import { getEpisode, warmStream } from '@/lib/streams';
import { clientIp } from '@/lib/gate';
import { hit } from '@/lib/limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pemanasan episode berikutnya: ambil data episode dan buka server videonya lebih dulu,
// sehingga saat pindah episode video langsung siap.
export async function GET(request) {
  if (!hit(`w:${clientIp(request.headers)}`, 30, 60_000)) return new Response(null, { status: 429 });
  const ep = new URL(request.url).searchParams.get('ep') || '';
  if (!/^[a-z0-9][a-z0-9-]{0,160}$/i.test(ep)) return new Response(null, { status: 400 });
  try {
    const d = await getEpisode(ep);
    if (Array.isArray(d?.streams) && d.streams.length) await warmStream(ep, d.streams);
  } catch {}
  return new Response(null, { status: 204 });
}
