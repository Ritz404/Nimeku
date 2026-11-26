'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, Compass, Bookmark, CalendarDays } from 'lucide-react';

// 5 tombol: Jelajah di tengah (menonjol), fitur pribadi di kiri-kanannya
const ITEMS = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/riwayat', label: 'Riwayat', icon: History },
  { href: '/jelajah', label: 'Jelajah', icon: Compass, center: true },
  { href: '/simpan', label: 'Simpan', icon: Bookmark },
  { href: '/jadwal', label: 'Jadwal', icon: CalendarDays },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-night border-t border-edge pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto grid grid-cols-5 h-16 items-center">
        {ITEMS.map(({ href, label, icon: Icon, center }) => {
          const active = isActive(href);
          const text = `text-[11px] font-semibold ${active ? 'text-sakura' : 'text-mist'}`;
          if (center) {
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className="flex flex-col items-center gap-0.5">
                <span className="-mt-6 size-12 rounded-full bg-sakura text-ink grid place-items-center ring-4 ring-night shadow-lg shadow-sakura/30 active:scale-90 transition-transform">
                  <Icon className="size-6" strokeWidth={2.4} />
                </span>
                <span className={text}>{label}</span>
              </Link>
            );
          }
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className="relative h-full flex flex-col items-center justify-center gap-1">
              <span className={`absolute top-0 h-0.5 rounded-full bg-sakura transition-all duration-300 ${active ? 'w-8' : 'w-0'}`} />
              <Icon className={`size-5 transition-colors ${active ? 'text-sakura' : 'text-mist'}`} />
              <span className={text}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
