// Dijalankan Next.js sekali saat server menyala. Mengisi cache data (beranda, semua tab Jelajah, genre, jadwal, donghua)
// lebih dulu, lalu menyegarkannya tiap beberapa menit di belakang layar, jadi pengunjung tidak menunggu API yang lambat.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return; // jangan memanggil API saat build

  const warm = async () => {
    try {
      const { fetchOmnify, apiPaused } = await import('./lib/api');
      if (apiPaused()) return;
      const { TABS, parseCatalog, pageUrl } = await import('./lib/catalog');
      const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
      const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).toLowerCase().replace(/[^a-z]/g, '');
      const day = DAYS.includes(today) ? today : 'senin';
      // Alamat dan lama cache sama persis dengan yang dipakai halaman, supaya hasilnya terpakai
      const jobs = [
        ['/anime/ongoing?page=1&per_page=20', 120],
        ['/anime/popular?period=weekly&page=1&per_page=10', 600],
        [`/anime/schedule?day=${day}`, 600],
        ['/anime/genres', 86400],
        ['/anime/donghua?page=1&per_page=20', 300],
        ['/anime/recommendations?page=1&per_page=10', 900],
        ['/anime/completed?page=1&per_page=10', 900],
        ['/anime/movies?page=1&per_page=10', 900],
        // halaman pertama tab Jelajah yang paling sering dibuka (tab lain dimuat saat dibuka lalu disimpan)
        ...TABS.filter((t) => ['populer', 'terbaru', 'berjalan', 'donghua'].includes(t.k)).map((t) => [pageUrl(parseCatalog({ tab: t.k }), 1), 300]),
        // jadwal seminggu dan daftar judul yang sedang tayang (dipakai melengkapi jadwal)
        ...DAYS.map((d) => [`/anime/schedule?day=${d}`, 600]),
        ...[1, 2, 3].map((p) => [`/anime/ongoing?page=${p}&per_page=50`, 600]),
        ...[1, 2].map((p) => [`/anime/donghua?page=${p}&per_page=50`, 600]),
      ];
      // Dua permintaan sekaligus dan berhenti seketika bila API mulai menolak
      for (let i = 0; i < jobs.length && !apiPaused(); i += 2) await Promise.all(jobs.slice(i, i + 2).map(([e, t]) => fetchOmnify(e, t).catch(() => {})));
      if (!globalThis.__nimekuWarmed) { globalThis.__nimekuWarmed = true; console.log('[warm] cache awal siap'); }
    } catch (err) { console.warn(`[warm] dilewati: ${err.message}`); }
  };

  if (process.env.WARM === '0' || globalThis.__nimekuWarmTimer) return; // WARM=0 di .env.local mematikan pemanasan
  setTimeout(warm, 1500);
  globalThis.__nimekuWarmTimer = setInterval(warm, 10 * 60 * 1000);
  globalThis.__nimekuWarmTimer.unref?.();
}
