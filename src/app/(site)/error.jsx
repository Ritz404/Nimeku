'use client';

// Halaman error ramah: tidak menampilkan pesan teknis atau alamat server API
export default function SiteError({ reset }) {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-10 pb-28 space-y-3 text-center">
      <h1 className="font-display text-lg">Data belum bisa dimuat</h1>
      <p className="text-sm text-mist">Server sedang sibuk atau gangguan sementara. Coba lagi sebentar.</p>
      <button type="button" onClick={() => reset()} className="rounded-full bg-sakura text-ink px-5 py-2 text-sm font-bold active:scale-95 transition-transform">Muat ulang</button>
    </div>
  );
}
