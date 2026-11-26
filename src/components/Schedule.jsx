'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Heart } from 'lucide-react';
import NextUp from '@/components/NextUp';
import { AirStatus } from '@/components/AirTime';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
// Pengelompokan menurut jam tayang (menit sejak tengah malam, WIB)
const SLOTS = [['Dini hari', 0, 360], ['Pagi', 360, 720], ['Siang', 720, 900], ['Sore', 900, 1080], ['Malam', 1080, 1440]];
const minutes = (t) => {
  const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmt = (v) => Number(v || 0).toLocaleString('id-ID');

// Semua hari sudah dikirim dari server, jadi berpindah hari langsung tampil tanpa menunggu apa pun
export default function Schedule({ days, today, initialDay }) {
  const [day, setDay] = useState(initialDay);
  const items = days[day] || [];
  const isToday = day === today;
  const pick = (d) => {
    setDay(d);
    try { history.replaceState(null, '', `/jadwal?day=${d}`); } catch {}
  };

  const offset = (DAYS.indexOf(day) - DAYS.indexOf(today) + 7) % 7;
  const dateText = new Date(Date.now() + offset * 864e5).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });
  const topViewed = [...items].sort((x, y) => y.views - x.views)[0];
  const groups = [...SLOTS.map(([name, from, to]) => [name, items.filter((x) => { const m = minutes(x.time); return m != null && m >= from && m < to; })]),
    ['Jam belum pasti', items.filter((x) => minutes(x.time) == null)]].filter(([, l]) => l.length);
  const hasEst = items.some((x) => x.est);

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-28 space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-lg">Jadwal rilis</h1>
        <span className="text-xs text-mist">Waktu Indonesia Barat</span>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {DAYS.map((d) => (
          <a key={d} href={`/jadwal?day=${d}`} aria-current={d === day ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); pick(d); }}
            className={`shrink-0 rounded-2xl px-4 py-2 text-center transition-colors active:scale-95 ${d === day ? 'bg-sakura text-ink' : 'bg-night text-mist ring-1 ring-edge'}`}>
            <span className="block text-xs font-bold capitalize">{d}{d === today && <span className={`ml-1.5 inline-block size-1.5 rounded-full align-middle ${d === day ? 'bg-ink' : 'bg-lantern'}`} title="Hari ini" />}</span>
            <span className="block text-[10px] font-semibold opacity-70">{(days[d] || []).length} judul</span>
          </a>
        ))}
      </div>

      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-bold capitalize">{day}</h2>
        <span className="text-sm text-mist">{dateText}</span>
        {isToday && <span className="rounded bg-sakura text-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Hari ini</span>}
        <span className="ml-auto text-xs text-mist">{items.length} judul</span>
      </div>

      {topViewed && topViewed.views > 0 && (
        <p className="text-xs text-mist">Paling ramai: <b className="text-paper">{topViewed.title}</b> ({fmt(topViewed.views)} penonton)</p>
      )}
      {hasEst && <p className="text-[11px] text-mist">Tanda ≈ pada jam berarti perkiraan dari waktu update terakhir, bukan jadwal resmi.</p>}

      {isToday && <NextUp items={items.map((n) => ({ id: n.slug, title: n.title, time: n.time }))} />}

      {items.length === 0 && <p className="text-sm text-mist">Belum ada jadwal untuk hari {day}.</p>}

      {groups.map(([name, list]) => (
        <section key={name} className="space-y-3">
          <h3 className="flex items-center gap-3 text-[11px] font-bold tracking-[.18em] text-mist uppercase">
            {name}<span className="font-medium tracking-normal normal-case">{list.length} judul</span><span className="h-px flex-1 bg-edge" />
          </h3>
          {/* Garis waktu: kolom jam (lebar tetap, angka sama lebar), titik di garis, lalu kartu */}
          <ol>
            {list.map((n, i) => {
              const m = minutes(n.time);
              return (
                <li key={n.slug || i} className="flex gap-2.5">
                  <div className="w-[3.25rem] shrink-0 pt-3.5 text-right">
                    <p className="text-[15px] font-extrabold leading-none tabular-nums text-lantern">{m == null ? '--:--' : `${n.est ? '≈' : ''}${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`}</p>
                    <p className="mt-1 text-[9px] font-bold tracking-widest text-mist">WIB</p>
                  </div>
                  <div className="relative w-3 shrink-0" aria-hidden="true">
                    <span className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-edge" />
                    <span className="absolute left-1/2 top-[18px] size-2.5 -translate-x-1/2 rounded-full bg-sakura ring-4 ring-ink" />
                  </div>
                  <Link href={`/anime/${encodeURIComponent(n.slug)}`} className="mb-2.5 flex min-w-0 flex-1 gap-3 rounded-2xl bg-night ring-1 ring-edge p-2.5 active:bg-edge/40 transition-colors">
                    <div className="w-12 aspect-[3/4] rounded-lg overflow-hidden skeleton shrink-0 self-start">
                      {n.poster && <img src={n.poster} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-sm font-bold leading-snug line-clamp-2">{n.title}</p>
                      {n.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1">{n.genres.map((g) => <span key={g} className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-mist">{g}</span>)}</div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mist">
                        {n.ep ? <span className="font-semibold text-paper">Ep {n.ep}</span> : null}
                        {Number(String(n.rating).replace(',', '.')) > 0 && <span>★ {n.rating}</span>}
                        {n.views > 0 && <span className="inline-flex items-center gap-1"><Eye className="size-3" />{fmt(n.views)}</span>}
                        {n.favorites > 0 && <span className="inline-flex items-center gap-1"><Heart className="size-3" />{fmt(n.favorites)}</span>}
                        <AirStatus time={n.time} today={isToday} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
