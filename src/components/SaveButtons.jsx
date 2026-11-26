'use client';

import { useState } from 'react';
import { Bookmark, Check, Clock, Share2 } from 'lucide-react';
import { useStored, write } from '@/lib/store';

// Hanya ringkasan anime yang disimpan (id, judul, poster, tipe) supaya ringan
export default function SaveButtons({ item }) {
  const [later] = useStored('later', []);
  const [marks] = useStored('bookmark', []);
  const [shared, setShared] = useState(false);
  // Bagikan lewat menu bagikan HP; jika tidak ada, salin tautan
  const share = async () => {
    const url = `${location.origin}/anime/${encodeURIComponent(item.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1800); }
    } catch {}
  };
  const toggle = (key, list) => {
    const has = list.some((x) => x.id === item.id);
    const entry = { id: item.id, title: item.title, poster: item.poster, type: item.type };
    write(key, has ? list.filter((x) => x.id !== item.id) : [entry, ...list].slice(0, 200));
  };
  const btn = (on, Icon, text, onText, onClick) => (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-bold active:scale-95 transition ${on ? 'bg-lantern text-ink' : 'bg-night ring-1 ring-edge'}`}>
      <Icon className="size-4" fill={on ? 'currentColor' : 'none'} /> {on ? onText : text}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      {btn(later.some((x) => x.id === item.id), Clock, 'Tonton nanti', 'Tersimpan', () => toggle('later', later))}
      {btn(marks.some((x) => x.id === item.id), Bookmark, 'Bookmark', 'Dibookmark', () => toggle('bookmark', marks))}
      <button type="button" onClick={share} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-bold active:scale-95 transition bg-night ring-1 ring-edge">
        {shared ? <Check className="size-4 text-lantern" /> : <Share2 className="size-4" />} {shared ? 'Disalin' : 'Bagikan'}
      </button>
    </div>
  );
}
