'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing } from 'lucide-react';

const parse = (t) => {
  const m = String(t).match(/(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Kartu "Tayang berikutnya" di halaman Jadwal: judul hari ini yang jam tayangnya paling dekat (menurut WIB)
export default function NextUp({ items }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => {
      const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).formatToParts(new Date());
      setNow(Number(p.find((x) => x.type === 'hour').value) * 60 + Number(p.find((x) => x.type === 'minute').value));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return null;
  const next = items
    .map((a) => ({ ...a, at: parse(a.time) }))
    .filter((a) => a.at != null && a.at > now)
    .sort((a, b) => a.at - b.at)[0];
  if (!next) return null;
  const d = next.at - now;
  return (
    <Link href={`/anime/${encodeURIComponent(next.id)}`} className="flex items-center gap-3 rounded-2xl bg-sakura text-ink p-3 active:scale-[.98] transition-transform">
      <span className="size-10 rounded-xl bg-ink/15 grid place-items-center shrink-0"><BellRing className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-[.18em] opacity-70">TAYANG BERIKUTNYA</span>
        <span className="block text-sm font-bold line-clamp-1">{next.title}</span>
      </span>
      <span className="text-right shrink-0">
        <span className="block font-display text-lg leading-none">{String(Math.floor(next.at / 60)).padStart(2, '0')}:{String(next.at % 60).padStart(2, '0')}</span>
        <span className="block text-[10px] font-bold opacity-70 mt-1">{d >= 60 ? `${Math.floor(d / 60)} jam ${d % 60} mnt` : `${d} menit`} lagi</span>
      </span>
    </Link>
  );
}
