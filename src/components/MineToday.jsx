'use client';

import Link from 'next/link';
import { BookmarkCheck } from 'lucide-react';
import { useStored } from '@/lib/store';

// Anime yang kamu bookmark dan tayang hari ini (dicocokkan dengan jadwal hari ini dari server)
export default function MineToday({ items }) {
  const [marks] = useStored('bookmark', []);
  const ids = new Set(marks.map((m) => m.id));
  const mine = items.filter((a) => a.id && ids.has(a.id));
  if (!mine.length) return null;
  return (
    <section className="space-y-3 reveal">
      <h2 className="flex items-center gap-2 text-sm font-bold"><BookmarkCheck className="size-4 text-lantern" /> Simpananmu tayang hari ini</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {mine.map((a) => (
          <Link key={a.id} href={`/anime/${encodeURIComponent(a.id)}`} className="shrink-0 w-64 flex items-center gap-3 rounded-2xl bg-night ring-1 ring-edge p-2.5 active:scale-95 transition-transform">
            {a.poster && <img src={a.poster} alt="" loading="lazy" className="size-14 rounded-xl object-cover shrink-0" />}
            <span className="min-w-0">
              <span className="block text-sm font-semibold line-clamp-2">{a.title}</span>
              {a.time && <span className="block text-[11px] font-semibold text-lantern mt-0.5">{a.time}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
