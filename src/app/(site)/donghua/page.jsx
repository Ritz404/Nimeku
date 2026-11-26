import AnimeCard from '@/components/AnimeCard';
import ResultGrid from '@/components/ResultGrid';
import { normalizeItem } from '@/lib/api';
import { FIRST_PAGES, firstPages, parseCatalog } from '@/lib/catalog';

export default async function DonghuaPage() {
  const c = parseCatalog({ tab: 'donghua' });
  const items = await firstPages(c); // dua halaman pertama; seluruh donghua menyusul otomatis saat digulir

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-28 space-y-5">
      <h1 className="font-display text-lg">Donghua</h1>
      {items.length === 0 ? (
        <p className="text-sm text-mist">Data belum bisa dimuat.</p>
      ) : (
        <ResultGrid key="donghua" meta={items.map((a) => { const n = normalizeItem(a); return { id: a.id || a.slug || a.title, title: n.title, rating: Number(String(n.rating).replace(',', '.')) || 0 }; })}
          more={{ qs: c.qs, next: FIRST_PAGES + 1 }}>
          {items.map((a, i) => <AnimeCard key={a.id || a.slug || i} anime={a} />)}
        </ResultGrid>
      )}
    </div>
  );
}
