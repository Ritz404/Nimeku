import Catalog from '@/components/Catalog';
import { normParams } from '@/lib/catalogdef';

// Hanya kerangka halaman yang dibuat di server (langsung tampil); daftar judul diambil dari browser lewat /api/list
// yang sudah dipanaskan, jadi membuka Jelajah, genre, atau tab tidak lagi menunggu API.
export default async function JelajahPage({ searchParams }) {
  const sp = await searchParams;
  return <Catalog initial={normParams(sp)} autoFocus={!!sp?.cari} />;
}
