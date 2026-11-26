import './globals.css';
import { Oswald, Dela_Gothic_One, Plus_Jakarta_Sans } from 'next/font/google';

// next/font mengunduh font saat build lalu menyajikannya dari domain sendiri (cepat, tanpa layout shift)
const display = Dela_Gothic_One({ weight: '400', subsets: ['latin'], variable: '--f-display' });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--f-body' });
// Font banner canvas: Oswald (judul, label, dan tombol; bobot 500 sampai 700)
const poster = Oswald({ subsets: ['latin'], variable: '--f-poster' });

export const metadata = {
  title: 'Nimeku - Nonton Anime Sub Indo',
  description: 'Nonton dan unduh anime sub indo cepat',
};
export const viewport = { themeColor: '#17132e' };

// Layout dasar saja. Navbar, menu bawah, dan splash ada di (site)/layout.jsx,
// supaya halaman verifikasi tampil bersih tanpa elemen situs.
export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${display.variable} ${body.variable} ${poster.variable} font-sans min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
