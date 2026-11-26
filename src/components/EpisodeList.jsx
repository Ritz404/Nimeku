'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Check, Play } from 'lucide-react';
import { useStored } from '@/lib/store';

const SIZE = 50; // jumlah episode per rentang pada anime panjang

// Daftar episode lengkap (tidak ada nomor yang terlewat). Anime panjang dibagi per rentang.
// Episode yang sudah selesai ditonton diberi tanda, dan urutan bisa dibalik (terbaru dulu).
export default function EpisodeList({ episodes, animeId }) {
  const total = episodes.length;
  const pages = Math.ceil(total / SIZE);
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(Math.max(0, pages - 1)); // rentang terbaru dibuka dulu
  const [hist] = useStored('history', []);
  const [seenList] = useStored(`seen:${animeId}`, []);
  const seen = new Set(seenList);
  const last = hist.find((h) => h.animeId === animeId);
  const href = (id) => `/watch/${encodeURIComponent(id)}`;
  const latest = episodes[total - 1];
  const list = desc ? [...episodes].reverse() : episodes;
  const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold active:scale-95 transition';
  const flip = () => { setPage(desc ? Math.max(0, pages - 1) : 0); setDesc((v) => !v); };
  const tone = (e, compact) => (e.n === last?.n ? `ring-2 ring-sakura ${compact ? 'text-sakura' : ''}` : seen.has(e.n) ? 'ring-1 ring-edge/60 text-mist' : 'ring-1 ring-edge');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {last && <Link href={href(last.epId)} className={`${btn} bg-sakura text-ink`}><Play className="size-3.5 fill-current" /> Lanjut Episode {last.n}</Link>}
        <Link href={href(episodes[0].id)} className={`${btn} bg-night ring-1 ring-edge`}>Episode 1</Link>
        {total > 1 && <Link href={href(latest.id)} className={`${btn} bg-night ring-1 ring-edge`}>Terbaru: Episode {latest.n}</Link>}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-between text-xs text-mist">
          <span>{seen.size > 0 ? `Sudah ditonton ${Math.min(seen.size, total)} dari ${total}` : `${total} episode`}</span>
          <button type="button" onClick={flip} className="inline-flex items-center gap-1.5 font-bold text-paper active:text-sakura">
            <ArrowDownUp className="size-3.5" /> {desc ? 'Terlama dulu' : 'Terbaru dulu'}
          </button>
        </div>
      )}

      {total <= 24 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {list.map((e) => (
            <Link key={e.id} href={href(e.id)}
              className={`rounded-xl bg-night px-3 py-3 text-center text-sm font-semibold active:bg-sakura active:text-ink transition-colors ${tone(e, false)}`}>
              {e.label}{seen.has(e.n) && <Check className="inline size-3.5 ml-1.5 -mt-0.5 text-lantern" aria-label="sudah ditonton" />}
            </Link>
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {Array.from({ length: pages }, (_, p) => {
              const chunk = list.slice(p * SIZE, (p + 1) * SIZE);
              return (
                <button key={p} type="button" onClick={() => setPage(p)} aria-pressed={p === page}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${p === page ? 'bg-sakura text-ink' : 'bg-night text-mist ring-1 ring-edge'}`}>
                  {chunk[0].n}-{chunk[chunk.length - 1].n}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {list.slice(page * SIZE, (page + 1) * SIZE).map((e) => (
              <Link key={e.id} href={href(e.id)} aria-label={e.label}
                className={`relative grid place-items-center rounded-lg bg-night py-2.5 text-xs font-bold active:bg-sakura active:text-ink transition-colors ${tone(e, true)}`}>
                {e.n}
                {seen.has(e.n) && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-lantern" aria-label="sudah ditonton" />}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
