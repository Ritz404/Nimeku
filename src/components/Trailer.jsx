'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';

// Tombol trailer: pemutar YouTube baru dimuat setelah ditekan (hemat kuota)
export default function Trailer({ id }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl bg-night ring-1 ring-edge px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform">
        <Film className="size-4 text-sakura" /> {open ? 'Tutup trailer' : 'Tonton trailer'}
      </button>
      {open && (
        <div className="aspect-video rounded-2xl overflow-hidden ring-1 ring-edge bg-night">
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title="Trailer"
            allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full border-0" />
        </div>
      )}
    </div>
  );
}
