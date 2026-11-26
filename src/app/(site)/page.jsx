import Link from 'next/link';
import AnimeCard from '@/components/AnimeCard';
import CanvasBanner from '@/components/CanvasBanner';
import ContinueRow from '@/components/ContinueRow';
import { fetchOmnify, pickList, collectAnime, normalizeItem, onlyAnime, isAdultGenre } from '@/lib/api';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const FALLBACK_GENRES = ['Action', 'Comedy', 'Romance', 'Fantasy', 'Drama', 'Adventure', 'Slice of Life', 'Sci-Fi', 'Supernatural', 'School'];

function Title({ kana, href, children }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-display text-lg">{children} {kana && <span className="ml-1 text-xs font-sans text-mist">{kana}</span>}</h2>
      {href && <Link href={href} className="text-xs font-semibold text-sakura">Lihat semua</Link>}
    </div>
  );
}

// Baris geser berisi kartu poster
function Rail({ kana, href, title, items }) {
  if (!items.length) return null;
  return (
    <section className="space-y-4 reveal">
      <Title kana={kana} href={href}>{title}</Title>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {items.map((a, i) => <div key={a.id || i} className="w-32 shrink-0"><AnimeCard anime={a} /></div>)}
      </div>
    </section>
  );
}

export default async function HomePage() {
  // Hari ini menurut WIB, untuk jadwal tayang
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).toLowerCase().replace(/[^a-z]/g, '');
  const day = DAYS.includes(today) ? today : 'senin';

  // Semua data diambil bersamaan dan disimpan sementara (cache) supaya halaman cepat dan hemat kuota API
  const [ongoingData, weeklyData, scheduleData, genreData, donghuaData, recData, doneData, movieData] = await Promise.all([
    fetchOmnify('/anime/ongoing?page=1&per_page=20', 120),
    fetchOmnify('/anime/popular?period=weekly&page=1&per_page=10', 600),
    fetchOmnify(`/anime/schedule?day=${day}`, 600),
    fetchOmnify('/anime/genres', 86400),
    fetchOmnify('/anime/donghua?page=1&per_page=20', 300),
    fetchOmnify('/anime/recommendations?page=1&per_page=10', 900),
    fetchOmnify('/anime/completed?page=1&per_page=10', 900),
    fetchOmnify('/anime/movies?page=1&per_page=10', 900),
  ]);
  const list = onlyAnime(pickList(ongoingData));
  const weekly = onlyAnime(pickList(weeklyData));
  const donghuaList = onlyAnime(pickList(donghuaData));
  const recs = onlyAnime(pickList(recData));
  const done = onlyAnime(pickList(doneData));
  const movies = onlyAnime(pickList(movieData));
  const todayList = collectAnime(scheduleData).slice(0, 10);
  const names = pickList(genreData).map((g) => (typeof g === 'string' ? g : g?.name || g?.title || g?.slug)).filter((g) => g && !isAdultGenre(g));
  const genres = (names.length ? names : FALLBACK_GENRES).slice(0, 16);

  // Banner: anime dan donghua yang baru update, diurutkan dari yang paling baru
  const toSlide = (a, type) => {
    const n = normalizeItem(a);
    const ep = a.current_episode || a.episode || '';
    return { id: `${type}-${n.slug}`, href: `/anime/${encodeURIComponent(n.slug)}`, watch: ep ? `/watch/${encodeURIComponent(`${n.slug}-ep-${ep}`)}` : `/anime/${encodeURIComponent(n.slug)}`, title: n.title, img: a.banner || n.poster, poster: n.poster || a.banner, studio: a.studio || '', rating: n.rating || '', genre: (Array.isArray(a.genres) ? (typeof a.genres[0] === 'string' ? a.genres[0] : a.genres[0]?.name) : '') || '', type,
      genres: (Array.isArray(a.genres) ? a.genres.map((g) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean).slice(0, 3) : []),
      views: Number(String(a.views ?? '').replace(/[^\d.]/g, '')) || 0,
      ep, ago: a.uploaded_ago || '', at: Date.parse(a.updated_at) || 0 };
  };
  const slides = [
    ...list.filter((a) => a.id && (a.banner || a.poster)).slice(0, 4).map((a) => toSlide(a, 'Anime')),
    ...onlyAnime(pickList(donghuaData)).filter((a) => a.id && (a.banner || a.poster)).slice(0, 3).map((a) => toSlide(a, 'Donghua')),
  ].sort((a, b) => b.at - a.at).slice(0, 6);

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-28 space-y-8">
      {slides.length > 0 && <CanvasBanner slides={slides} />}

      <ContinueRow />

      {todayList.length > 0 && (
        <section className="space-y-4 reveal">
          <Title kana="今日" href={`/jadwal?day=${day}`}>Tayang hari ini</Title>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {todayList.map((a, i) => <div key={a.id || i} className="w-32 shrink-0"><AnimeCard anime={a} today /></div>)}
          </div>
        </section>
      )}

      <section className="space-y-3 reveal">
        <Title kana="ジャンル">Genre</Title>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {genres.map((g) => (
            <Link key={g} href={`/jelajah?genre=${encodeURIComponent(g.toLowerCase().replace(/\s+/g, '-'))}`}
              className="shrink-0 rounded-full bg-night ring-1 ring-edge px-4 py-2 text-xs font-bold text-mist active:bg-sakura active:text-ink transition-colors">
              {g}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4 reveal">
        <Title kana="新着" href="/jelajah?tab=terbaru">Rilis terbaru</Title>
        {list.length === 0 ? (
          <p className="text-sm text-mist">Data belum bisa dimuat. Coba muat ulang halaman.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-5">
            {list.map((a, i) => <AnimeCard key={a.id || a.slug || i} anime={a} index={i} animate={i < 8} />)}
          </div>
        )}
      </section>

      {weekly.length > 0 && (
        <section className="space-y-4 reveal">
          <Title kana="人気" href="/jelajah?tab=populer">Populer minggu ini</Title>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {weekly.map((a, i) => <div key={a.id || i} className="w-32 shrink-0"><AnimeCard anime={a} /></div>)}
          </div>
        </section>
      )}

      <Rail kana="国漫" href="/donghua" title="Donghua" items={donghuaList} />

      <Rail kana="おすすめ" href="/jelajah?tab=rekomendasi" title="Rekomendasi" items={recs} />
      <Rail kana="完結" href="/jelajah?tab=tamat" title="Sudah tamat" items={done} />
      <Rail kana="映画" href="/jelajah?tab=film" title="Film" items={movies} />
    </div>
  );
}
