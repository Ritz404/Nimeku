import Schedule from '@/components/Schedule';
import { DAYS, loadSchedule } from '@/lib/schedule';

export default async function JadwalPage({ searchParams }) {
  const sp = await searchParams;
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).toLowerCase().replace(/[^a-z]/g, '');
  const todayKey = DAYS.includes(today) ? today : 'senin';
  const day = DAYS.includes(sp?.day) ? sp.day : todayKey;
  // Data seminggu dimuat sekaligus dari cache server; berpindah hari tidak perlu meminta apa-apa lagi
  const days = await loadSchedule();
  return <Schedule days={days} today={todayKey} initialDay={day} />;
}
