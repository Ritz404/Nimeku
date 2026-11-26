'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import AnimeCard from '@/components/AnimeCard';
import ResultGrid from '@/components/ResultGrid';
import { normalizeItem } from '@/lib/normalize';
import { STATUS, TABS_UI, TYPES, normParams, qsOf } from '@/lib/catalogdef';

const sel = 'w-full rounded-xl bg-night border border-edge px-3 py-2.5 text-sm focus:border-sakura focus:outline-none';

// Daftar halaman pertama per pencarian, disimpan di browser: berpindah tab yang sudah pernah dibuka langsung tampil
const mem = new Map(); // qs -> { items, at }
const inflight = new Map();
const TTL = 5 * 60 * 1000;
const cached = (qs) => { const m = mem.get(qs); return m && Date.now() - m.at < TTL ? m.items : null; };
function page1(qs) {
  const c = cached(qs);
  if (c) return Promise.resolve(c);
  if (inflight.has(qs)) return inflight.get(qs);
  const pr = fetch(`/api/list?${qs}&page=1`)
    .then((r) => { if (!r.ok) throw new Error('http'); return r.json(); })
    .then((j) => { const items = j.items || []; mem.set(qs, { items, at: Date.now() }); if (mem.size > 60) mem.delete(mem.keys().next().value); return items; })
    .finally(() => inflight.delete(qs));
  inflight.set(qs, pr);
  return pr;
}

// Jelajah: semua perpindahan (tab, genre, filter, pencarian) terjadi di sini tanpa memuat ulang halaman.
// Tab langsung menyala saat disentuh, data diambil dari /api/list yang sudah dipanaskan, dan tab lain dimuat diam-diam di belakang.
export default function Catalog({ initial, autoFocus = false }) {
  const [p, setP] = useState(initial);
  const [view, setView] = useState({ qs: qsOf(initial), items: null, error: false });
  const [genres, setGenres] = useState([]);
  const [text, setText] = useState(initial.q);
  const [open, setOpen] = useState(!!(initial.genre || initial.filtering));
  const [tries, setTries] = useState(0);
  const filterRef = useRef(null);

  const go = (next) => {
    const np = normParams({ ...p, ...next });
    setP(np);
    try {
      const qs = qsOf(np);
      history.replaceState(null, '', qs && !(np.plain && np.tab === 'populer') ? `/jelajah?${qs}` : '/jelajah');
    } catch {}
  };

  useEffect(() => {
    let alive = true;
    const qs = qsOf(p);
    const c = cached(qs);
    setView({ qs, items: c, error: false });
    if (!c) page1(qs).then((items) => alive && setView({ qs, items, error: false })).catch(() => alive && setView({ qs, items: null, error: true }));
    return () => { alive = false; };
  }, [p, tries]);

  // Genre untuk filter. Tab lain hanya dimuat lebih awal saat disentuh (lihat warm), supaya tidak membebani API.
  useEffect(() => {
    let dead = false;
    fetch('/api/genres').then((r) => r.json()).then((j) => !dead && setGenres(j.genres || [])).catch(() => {});
    return () => { dead = true; };
  }, []);

  const warm = (k) => { page1(qsOf(normParams({ tab: k }))).catch(() => {}); };
  const title = p.q ? `Hasil untuk “${p.q}”` : [p.genre && p.genre.replace(/-/g, ' '), p.type, p.status && (p.status === 'ongoing' ? 'berjalan' : 'tamat')].filter(Boolean).join(', ') || 'Hasil filter';
  const items = view.items;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-28 space-y-5">
      <form action="/jelajah" className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: text, genre: '', status: '', type: '' }); document.activeElement?.blur?.(); }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-mist" />
        <input name="q" value={text} onChange={(e) => setText(e.target.value)} autoFocus={autoFocus} placeholder="Cari judul anime"
          className="w-full rounded-full bg-night border border-edge pl-11 pr-4 py-3 text-sm placeholder:text-mist/70 focus:border-sakura focus:outline-none" />
      </form>

      {!p.q && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {TABS_UI.map((t) => (
            <a key={t.k} href={`/jelajah?tab=${t.k}`} aria-current={p.plain && t.k === p.tab ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); setText(''); go({ tab: t.k, q: '', genre: '', status: '', type: '' }); }}
              onPointerEnter={() => warm(t.k)} onTouchStart={() => warm(t.k)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors active:scale-95 ${p.plain && t.k === p.tab ? 'bg-sakura text-ink' : 'bg-night text-mist ring-1 ring-edge'}`}>
              {t.label}
            </a>
          ))}
        </div>
      )}

      {!p.q && (
        <details ref={filterRef} className="rounded-2xl bg-night ring-1 ring-edge" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="flex items-center gap-2 cursor-pointer list-none px-4 py-3 text-xs font-bold">
            <SlidersHorizontal className="size-4 text-sakura" /> Filter genre, status, jenis
          </summary>
          <form action="/jelajah" className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 pb-4"
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); go({ q: '', genre: f.get('genre') || '', status: f.get('status') || '', type: f.get('type') || '' }); }}>
            <select name="genre" value={p.genre} onChange={(e) => go({ genre: e.target.value })} className={sel} aria-label="Genre">
              <option value="">Semua genre</option>
              {p.genre && !genres.some((g) => String(g).toLowerCase().replace(/\s+/g, '-') === p.genre) && <option value={p.genre}>{p.genre.replace(/-/g, ' ')}</option>}
              {genres.map((g) => <option key={g} value={String(g).toLowerCase().replace(/\s+/g, '-')}>{g}</option>)}
            </select>
            <select name="status" value={p.status} onChange={(e) => go({ status: e.target.value })} className={sel} aria-label="Status">
              {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select name="type" value={p.type} onChange={(e) => go({ type: e.target.value })} className={sel} aria-label="Jenis">
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </form>
        </details>
      )}

      {p.q && <h1 className="font-display text-lg">{title}</h1>}
      {!p.q && !p.plain && (
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-lg capitalize">{title}</h1>
          <a href="/jelajah" onClick={(e) => { e.preventDefault(); go({ tab: 'populer', genre: '', status: '', type: '' }); }} className="text-xs font-semibold text-sakura">Reset</a>
        </div>
      )}

      {view.error ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm text-mist">Data belum bisa dimuat.</p>
          <button type="button" onClick={() => setTries((n) => n + 1)} className="rounded-full bg-sakura text-ink px-5 py-2.5 text-xs font-bold active:scale-95 transition-transform">Coba lagi</button>
        </div>
      ) : items === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-5" aria-busy="true" aria-label="Memuat daftar">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}><div className="aspect-[3/4] rounded-2xl skeleton" /><div className="mt-2 h-3 w-4/5 rounded skeleton" /></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-mist">{p.q ? 'Tidak ada judul yang cocok. Coba kata kunci lain.' : 'Belum ada judul di daftar ini.'}</p>
      ) : (
        <ResultGrid key={view.qs} controls={false}
          meta={items.map((a) => { const n = normalizeItem(a); return { id: a.id || a.slug || a.title, title: n.title, rating: Number(String(n.rating).replace(',', '.')) || 0 }; })}
          more={{ qs: view.qs, next: 2 }}>
          {items.map((a, i) => <AnimeCard key={a.id || a.slug || i} anime={a} />)}
        </ResultGrid>
      )}
    </div>
  );
}
