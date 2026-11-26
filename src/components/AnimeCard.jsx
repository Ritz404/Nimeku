import Link from 'next/link';
import { normalizeItem } from '@/lib/normalize';
import AirTime from '@/components/AirTime';
import Poster from '@/components/Poster';

// Kartu poster dipakai di Beranda, Jelajah, Donghua, dan Jadwal
export default function AnimeCard({ anime, index = 0, animate = false, today = false }) {
  const a = normalizeItem(anime);
  return (
    <Link
      href={`/anime/${encodeURIComponent(a.slug)}`}
      style={{ '--i': index }}
      className={`group block active:scale-[.97] transition-transform ${animate ? 'rise' : ''}`}
    >
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden skeleton ring-1 ring-edge">
        <Poster src={a.poster} title={a.title} slug={a.slug} />
        {a.type && (
          <span className="absolute top-2 left-2 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-bold">{a.type}</span>
        )}
        {a.episode && (
          <span className="absolute bottom-2 left-2 rounded-full bg-sakura text-ink px-2 py-0.5 text-[10px] font-bold">Ep {a.episode}</span>
        )}
        {a.rating && (
          <span className="absolute bottom-2 right-2 rounded-full bg-lantern text-ink px-2 py-0.5 text-[10px] font-bold">★ {a.rating}</span>
        )}
      </div>
      <h3 className="mt-2 text-xs font-semibold leading-snug line-clamp-2 text-paper">{a.title}</h3>
      {a.time && <AirTime text={a.time} today={today} />}
    </Link>
  );
}
