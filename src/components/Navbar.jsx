'use client';

import Link from 'next/link';
import { Bell, Settings, Users } from 'lucide-react';
import { useStored } from '@/lib/store';

export default function Navbar() {
  const [notif] = useStored('notif', []);
  const unread = notif.filter((x) => !x.read).length;

  return (
    <header className="sticky top-0 z-40 bg-ink border-b border-edge">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="size-9 rounded-xl bg-sakura text-ink grid place-items-center font-display text-lg leading-none">N</span>
          <span className="font-display text-lg leading-none">Nimeku</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notifikasi" aria-label={unread ? `Update episode, ${unread} belum dibaca` : 'Update episode'} className="relative size-10 rounded-full bg-night grid place-items-center active:scale-90 transition-transform">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-sakura text-ink text-[10px] font-bold grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
          </Link>
          <Link href="/pengaturan" aria-label="Pengaturan" className="size-10 rounded-full bg-night grid place-items-center active:scale-90 transition-transform">
            <Settings className="size-5" />
          </Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event('nimeku:community'))} aria-label="Komunitas"
            className="size-10 rounded-full bg-night grid place-items-center active:scale-90 transition-transform">
            <Users className="size-5" />
          </button>
        </div>
      </div>
      <span className="scroll-progress" aria-hidden="true" />
    </header>
  );
}
