'use client';

import { Children, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import AnimeCard from '@/components/AnimeCard';
import { normalizeItem } from '@/lib/normalize';

const STEP = 48; // jumlah kartu yang ditambahkan tiap kali layar mendekati ujung daftar
const SORTS = [['asli', 'Bawaan'], ['az', 'A-Z'], ['nilai', 'Nilai']];
const idOf = (a) => a.id || a.slug || a.title;
const metaOf = (a) => { const n = normalizeItem(a); return { id: idOf(a), title: n.title, rating: Number(String(n.rating).replace(',', '.')) || 0 }; };

// Daftar poster. Halaman pertama datang dari server (cepat); sisanya dimuat otomatis dari /api/list saat digulir
// sampai API tidak punya judul lagi, jadi seluruh katalog bisa dijelajahi. Bisa disaring per judul dan diurutkan.
// more = { qs, next, skip } -> parameter daftar, nomor halaman berikutnya, id yang sudah tampil di tempat lain.
export default function ResultGrid({ meta, children, more = null, controls = true }) {
  const cards = Children.toArray(children);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('asli');
  const [shown, setShown] = useState(STEP);
  const [extra, setExtra] = useState([]);
  const [done, setDone] = useState(!more);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef(null);
  const page = useRef(more?.next || 1);
  const busyRef = useRef(false);
  const dupRuns = useRef(0);
  const seen = useRef(new Set([...meta.map((m) => m.id), ...(more?.skip || [])]));

  const allMeta = useMemo(() => [...meta, ...extra.map(metaOf)], [meta, extra]);
  const all = [...cards, ...extra.map((a) => <AnimeCard key={`x-${idOf(a)}`} anime={a} />)];

  const order = useMemo(() => {
    const term = q.trim().toLowerCase();
    const idx = allMeta.map((_, i) => i).filter((i) => !term || allMeta[i].title.toLowerCase().includes(term));
    if (sort === 'az') idx.sort((a, b) => allMeta[a].title.localeCompare(allMeta[b].title, 'id'));
    if (sort === 'nilai') idx.sort((a, b) => allMeta[b].rating - allMeta[a].rating);
    return idx;
  }, [allMeta, q, sort]);

  const loadMore = async () => {
    if (!more || done || busyRef.current) return;
    busyRef.current = true; setBusy(true); setFailed(false);
    try {
      const r = await fetch(`/api/list?${more.qs}&page=${page.current}`);
      if (!r.ok) throw new Error('http');
      const items = (await r.json()).items || [];
      page.current += 1;
      const fresh = items.filter((a) => { const id = idOf(a); if (!id || seen.current.has(id)) return false; seen.current.add(id); return true; });
      if (fresh.length) { dupRuns.current = 0; setExtra((e) => [...e, ...fresh]); }
      // Habis: halaman kosong, atau dua halaman berturut-turut hanya berisi judul yang sudah ada (API mengulang halaman terakhir)
      else if (items.length === 0 || ++dupRuns.current >= 2 || page.current > 400) setDone(true);
    } catch { setFailed(true); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const loadRef = useRef(loadMore);
  loadRef.current = loadMore;

  useEffect(() => { setShown(STEP); }, [q, sort]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      if (shown < order.length) setShown((n) => n + STEP);
      else if (!q.trim() && !failed) loadRef.current(); // saat menyaring, jangan otomatis menyedot seluruh katalog
    }, { rootMargin: '700px' });
    io.observe(el);
    return () => io.disconnect();
  }, [order.length, shown, done, failed, q, busy]);

  return (
    <div className="space-y-4">
      {controls && <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-mist" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Saring judul di daftar ini" aria-label="Saring judul"
            className="w-full rounded-xl bg-night border border-edge pl-10 pr-3 py-2.5 text-sm placeholder:text-mist/70 focus:border-sakura focus:outline-none" />
        </label>
        <div className="flex gap-2" role="group" aria-label="Urutkan">
          {SORTS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k}
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${sort === k ? 'bg-sakura text-ink' : 'bg-night text-mist ring-1 ring-edge'}`}>{l}</button>
          ))}
        </div>
      </div>}
      {controls && <p className="text-xs text-mist">{order.length} judul{!done && ' dimuat'}{q.trim() && ` cocok dengan "${q.trim()}"`}</p>}

      {order.length === 0 && done ? (
        <p className="text-sm text-mist">Tidak ada judul yang cocok di daftar ini.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-5">
          {order.slice(0, shown).map((i) => all[i])}
        </div>
      )}

      {(shown < order.length || !done) && <div ref={sentinel} className="h-10" aria-hidden="true" />}
      {more && !done && shown >= order.length && (
        <div className="text-center">
          {busy ? (
            <p className="text-xs text-mist" role="status">Memuat lebih banyak…</p>
          ) : (
            <button type="button" onClick={loadMore} className="rounded-full bg-night ring-1 ring-edge px-5 py-2.5 text-xs font-bold active:scale-95 transition-transform">
              {failed ? 'Gagal memuat. Coba lagi' : q.trim() ? 'Cari di judul berikutnya' : 'Muat lebih banyak'}
            </button>
          )}
        </div>
      )}
      {more && done && extra.length > 0 && <p className="text-center text-xs text-mist">Sudah sampai akhir daftar.</p>}
    </div>
  );
}
