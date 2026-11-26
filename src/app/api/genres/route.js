import { NextResponse } from 'next/server';
import { fetchOmnify, pickList, isAdultGenre } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Daftar genre untuk filter di halaman Jelajah (disimpan lama di server dan di browser)
export async function GET() {
  const names = pickList(await fetchOmnify('/anime/genres', 86400))
    .map((g) => (typeof g === 'string' ? g : g?.slug || g?.name || g?.title))
    .filter((g) => g && !isAdultGenre(g));
  return NextResponse.json({ genres: names }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
