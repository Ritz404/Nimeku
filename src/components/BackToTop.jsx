'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// Tombol kecil kembali ke atas, muncul setelah halaman digulir cukup jauh
export default function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <button type="button" aria-label="Kembali ke atas" tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
      className={`fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-11 rounded-full bg-sakura text-ink grid place-items-center shadow-lg shadow-black/40 transition-all duration-300 active:scale-90 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
      <ArrowUp className="size-5" strokeWidth={2.6} />
    </button>
  );
}
