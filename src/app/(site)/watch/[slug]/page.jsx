import WatchClient from '@/components/WatchClient';
import { fetchOmnify, buildEpisodes, hideHost } from '@/lib/api';
import { warmStream, fmtOf, getEpisode } from '@/lib/streams';

const hasStreams = (d) => [d?.streams, d?.servers, d?.sources].some((x) => Array.isArray(x) && x.length);

export default async function WatchPage({ params }) {
  const { slug = '' } = await params;
  const base = slug.replace(/-ep-\d+$/, '');
  const getEp = (force) => getEpisode(slug, force).catch(() => null); // data mentah: link stream hanya dipakai server

  // Episode dan info anime diambil bersamaan supaya halaman tidak menunggu dua kali
  let [episodeData, detail] = await Promise.all([getEp(), fetchOmnify(`/anime/detail?id=${encodeURIComponent(base)}`, 600)]);

  // Sumber video kadang baru siap setelah permintaan pertama, dan API sesekali menjawab error sesaat.
  // Gagal total (null): coba sampai 2 kali lagi dengan jeda. Ada data tapi tanpa stream: coba sekali lagi.
  if (!episodeData || !hasStreams(episodeData)) {
    const waits = episodeData ? [1000] : [1000, 2500];
    for (const ms of waits) {
      await new Promise((r) => setTimeout(r, ms));
      episodeData = (await getEp(true)) || episodeData;
      if (hasStreams(episodeData)) break;
    }
    if (!hasStreams(episodeData)) console.warn(`[API] episode ${slug} tanpa stream. ${episodeData ? `Field: ${Object.keys(episodeData).join(', ')}` : 'API tidak memberi data.'}`);
  }

  // Pemanasan server video di latar belakang (tidak ditunggu)
  const list = [episodeData?.streams, episodeData?.servers, episodeData?.sources].find((x) => Array.isArray(x) && x.length);
  if (list) warmStream(slug, list).catch(() => {});

  const anime = detail && {
    id: base,
    title: detail.title,
    poster: detail.poster,
    banner: detail.banner,
    synopsis: detail.synopsis,
    genres: Array.isArray(detail.genres) ? detail.genres : [],
    status: detail.status,
    type: detail.type,
    studio: detail.studio,
    season: detail.season,
  };
  // Browser hanya perlu tahu kualitas, server, dan format. Link stream diganti penanda kosong "x"
  // (link asli tidak pernah dikirim ke browser; video diputar lewat /api/stream).
  const strip = (arr) => (Array.isArray(arr) ? arr.map((s) => {
    const o = { ...s, format: fmtOf(s) };
    for (const k of ['stream_url', 'url', 'link', 'src', 'file']) if (o[k]) o[k] = 'x';
    return o;
  }) : arr);
  const safeEp = episodeData && hideHost({ ...episodeData, streams: strip(episodeData.streams), servers: strip(episodeData.servers), sources: strip(episodeData.sources) });

  // key={slug}: pindah episode memulai pemutar dari nol (state tidak terbawa)
  return <WatchClient key={slug} episodeData={safeEp} slug={slug} anime={anime} episodes={buildEpisodes(detail, base)} />;
}
