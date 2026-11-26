'use client';

import { useEffect } from 'react';
import { read } from '@/lib/store';

// Menerapkan warna aksen pilihan pengguna (Pengaturan) ke seluruh situs
export default function Accent() {
  useEffect(() => {
    const apply = () => {
      const c = read('accent', '');
      const st = document.documentElement.style;
      if (/^#[0-9a-f]{6}$/i.test(c || '')) st.setProperty('--color-sakura', c);
      else st.removeProperty('--color-sakura');
      window.dispatchEvent(new Event('nimeku:accent'));
    };
    apply();
    window.addEventListener('nimeku:store', apply);
    return () => window.removeEventListener('nimeku:store', apply);
  }, []);
  return null;
}
