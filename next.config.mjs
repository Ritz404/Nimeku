/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Izinkan domain Anda mengakses server dev (menghilangkan peringatan cross-origin)
  allowedDevOrigins: ['nimeku.freyamd.web.id'],
  // Alamat server API disembunyikan dari pengunjung: gambar dan berkas diminta lewat /img/... lalu diteruskan
  // oleh route handler di src/app/img/[...path]/route.js (yang juga memberi cache panjang untuk gambar)
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
