import Link from 'next/link';
import { X } from 'lucide-react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// "3 jam lalu", "kemarin", dst. dari waktu terakhir ditonton
const ago = (at) => {
  if (!at) return '';
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} jam lalu`;
  const d = Math.floor(m / 1440);
  return d === 1 ? 'kemarin' : `${d} hari lalu`;
};

export default function HistoryCard({ h, onRemove, className = '' }) {
  const pct = h.d ? Math.min(100, Math.round((h.t / h.d) * 100)) : 0;
  return (
    <div className={`relative rounded-2xl bg-night ring-1 ring-edge overflow-hidden ${className}`}>
      <Link href={`/watch/${encodeURIComponent(h.epId)}`} className="flex gap-3 p-3 active:bg-edge/40">
        <div className="w-16 aspect-[3/4] rounded-lg overflow-hidden skeleton shrink-0">
          {h.poster && <img src={h.poster} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1 pr-6">
          <p className="text-sm font-bold leading-snug line-clamp-2">{h.title}</p>
          <p className="text-xs text-lantern font-semibold">Episode {h.n}</p>
          <p className="text-xs text-mist">{pct >= 92 ? 'Hampir selesai' : h.t > 0 ? `Lanjut dari menit ${fmt(h.t)}` : 'Mulai episode ini'}{h.at ? ` · ${ago(h.at)}` : ''}</p>
        </div>
      </Link>
      {pct > 0 && <div className="h-1 bg-edge"><div className="h-full bg-sakura" style={{ width: `${pct}%` }} /></div>}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Hapus dari riwayat" className="absolute top-2 right-2 size-7 rounded-full bg-ink/70 grid place-items-center active:scale-90">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
