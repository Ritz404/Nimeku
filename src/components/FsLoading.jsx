'use client';

import Loader from '@/components/Loader';
import { fsFlag } from '@/lib/fsflag';

// Selama episode berikutnya dimuat dalam layar penuh, tampilkan layar hitam polos
// supaya halaman situs tidak sempat terlihat di tengah-tengah.
export default function FsLoading() {
  if (typeof document === 'undefined' || !fsFlag.on || !document.fullscreenElement) return null;
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black">
      <Loader label="Memuat episode…" />
    </div>
  );
}
