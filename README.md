# Nimeku

Aplikasi web berbasis **Next.js** untuk menjelajah dan menonton konten anime serta donghua, dilengkapi jadwal tayang, riwayat dan statistik tontonan, daftar simpan, notifikasi rilis, serta verifikasi akses.

## Fitur Utama

- **Katalog & Halaman Utama:** Halaman beranda (`src/app/(site)/page.jsx`), jelajah (`/jelajah`), anime (`/anime`, `/anime/[slug]`), donghua (`/donghua`), acak (`/acak`), dan halaman tonton (`/watch/[slug]`).
- **Jadwal & Aktivitas Pengguna:** Jadwal rilis (`/jadwal`), riwayat dan statistik tontonan (`HistoryCard.jsx`, `WatchStats.jsx`, `/riwayat`), daftar simpan (`SaveButtons.jsx`, `/simpan`), serta pemantau pembaruan dan notifikasi (`UpdateWatcher.jsx`, `/notifikasi`).
- **Keamanan & Verifikasi:** Halaman verifikasi (`src/app/verifikasi/page.jsx`), middleware (`src/middleware.js`), serta endpoint Turnstile (`src/app/api/turnstile/route.js`).
- **Endpoint API & Utilitas:** Route API di `src/app/api/` (`stream`, `list`, `suggest`, `update`, `genres`, `cek`, `warm`), proxy/cache gambar (`src/app/img/[...path]/route.js`), service worker (`public/sw.js`), dan skrip bantu (`serve.mjs`, `watch.mjs`, `tes.mjs`, `peek.mjs`).

## Struktur Folder Utama

- `src/app/` — App Router, layout utama, middleware, halaman verifikasi, dan route API.
- `src/components/` — Komponen antarmuka seperti `Catalog.jsx`, `Schedule.jsx`, `EpisodeList.jsx`, `WatchClient.jsx`, `Navbar.jsx`, dan `BottomNav.jsx`.
- `src/lib/` — Modul logika katalog, jadwal, stream, penyimpanan lokal, notifikasi, dan pembatasan akses.
- `public/` — Berkas statis publik dan service worker (`sw.js`).

## Instalasi & Menjalankan Lokal

1. **Instal dependensi:**
   ```bash
   npm install
