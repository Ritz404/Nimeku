// Dipisah dari api.js supaya komponen browser bisa memakainya tanpa ikut membawa alamat server API
// Samakan nama field item anime dari API (API memakai "id" untuk alamat detail)
export function normalizeItem(a = {}) {
  return {
    slug: a.id || a.slug || a.anime_id || a.anime_slug || '',
    title: a.title || a.name || '',
    poster: a.poster || a.image || a.thumbnail || a.cover || a.img || '',
    banner: a.banner || a.cover || '',
    type: a.type || '',
    rating: a.rating || a.score || '',
    episode: a.current_episode || '',
    time: a.time || a.air_time || a.release_time || a.jam || a.broadcast || '',
  };
}
