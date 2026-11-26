import Link from 'next/link';
import EpisodeList from '@/components/EpisodeList';
import SaveButtons from '@/components/SaveButtons';
import Trailer from '@/components/Trailer';
import { fetchOmnify, buildEpisodes, youtubeId } from '@/lib/api';

export default async function AnimeDetailPage({ params }) {
  const { slug = '' } = await params;
  // Jangan panggil API kalau alamatnya rusak (mis. /anime/undefined)
  const bad = !slug || slug === 'undefined';
  const [detail, trailerData] = bad ? [null, null] : await Promise.all([
    fetchOmnify(`/anime/detail?id=${encodeURIComponent(slug)}`, 600),
    fetchOmnify(`/anime/trailer?id=${encodeURIComponent(slug)}`, 3600),
  ]);
  const yt = youtubeId(trailerData);

  const eps = buildEpisodes(detail, slug);

  const facts = [detail?.studio, detail?.duration, detail?.season].filter(Boolean).join(', ');

  if (bad || !detail) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-28 space-y-3">
        <h1 className="font-display text-lg">Anime tidak ditemukan</h1>
        <p className="text-sm text-mist">Alamat ini tidak valid atau data belum bisa dimuat.</p>
        <Link href="/" className="inline-block rounded-full bg-sakura text-ink px-4 py-2 text-sm font-bold">Ke beranda</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-28 space-y-5">
      {detail.banner && <img src={detail.banner} alt="" decoding="async" className="w-full aspect-[16/8] object-cover rounded-3xl ring-1 ring-edge skeleton" />}
      <div className="flex gap-4">
        {detail.poster && <img src={detail.poster} alt="" className="w-28 aspect-[3/4] rounded-2xl object-cover shrink-0 ring-1 ring-edge" />}
        <div className="space-y-2 min-w-0">
          <h1 className="font-display text-xl leading-tight">{detail.title}</h1>
          {facts && <p className="text-xs text-lantern font-semibold">{facts}</p>}
          {detail.status && <p className="text-xs text-mist">{[detail.type, detail.status].filter(Boolean).join(', ')}</p>}
          <SaveButtons item={{ id: slug, title: detail.title, poster: detail.poster, type: detail.type }} />
        </div>
      </div>
      {Array.isArray(detail.genres) && detail.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {detail.genres.slice(0, 8).map((g) => (
            <span key={g} className="rounded-full bg-night ring-1 ring-edge px-3 py-1 text-[11px] text-mist">{g}</span>
          ))}
        </div>
      )}
      {detail.synopsis && <p className="text-sm leading-relaxed text-mist max-w-prose">{detail.synopsis}</p>}
      {yt && <Trailer id={yt} />}
      <section className="space-y-3">
        <h2 className="font-display text-base">Episode</h2>
        <EpisodeList episodes={eps} animeId={slug} />
      </section>
    </div>
  );
}
