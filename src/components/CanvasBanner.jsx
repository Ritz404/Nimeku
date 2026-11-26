'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const SLIDE_MS = 6500;
const FADE_MS = 520;
const INK = '23,19,46';
const LANTERN = '#ffc857';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - (1 - clamp01(x)) ** 3;
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(n));

// Pecah judul menjadi maksimal N baris sesuai lebar, baris terakhir dipotong dengan "…"
function wrapText(ctx, text, maxW, maxLines) {
  const lines = [];
  let cur = '';
  for (const word of String(text).split(/\s+/)) {
    const t = cur ? `${cur} ${word}` : word;
    if (!cur || ctx.measureText(t).width <= maxW) cur = t;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let l = lines[maxLines - 1];
    while (l.length > 1 && ctx.measureText(`${l}…`).width > maxW) l = l.slice(0, -1);
    lines[maxLines - 1] = `${l}…`;
  }
  return lines;
}

function box(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Banner di <canvas> dengan tata letak sejajar: atas kolom teks sejajar dengan atas poster, tombol sejajar dengan bawah poster,
// semua teks rata kiri pada satu garis. Gerak: latar zoom dan geser pelan, poster masuk dari kanan lalu zoom pelan dengan kilau
// sesekali, teks naik dari balik garis bergantian. Saat pindah slide teks lama memudar lebih dulu, baru teks baru masuk
// (tidak pernah ada dua teks bertumpuk). Berhenti menggambar saat tidak terlihat; "kurangi animasi" mematikan gerak.
// Hanya tombol Tonton dan Detail yang membuka halaman; geser kiri/kanan ganti slide.
export default function CanvasBanner({ slides }) {
  const router = useRouter();
  const wrap = useRef(null);
  const cv = useRef(null);

  useEffect(() => {
    const canvas = cv.current;
    const holder = wrap.current;
    if (!canvas || !holder || slides.length === 0) return;
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = !reduce;
    const css = getComputedStyle(document.body);
    const head = css.getPropertyValue('--f-poster').trim() || css.getPropertyValue('--f-display').trim() || 'sans-serif';
    const sans = css.getPropertyValue('--f-body').trim() || 'sans-serif';
    const readAccent = () => getComputedStyle(document.documentElement).getPropertyValue('--color-sakura').trim() || '#ff6b8b';
    let accent = readAccent();
    const onAccent = () => { accent = readAccent(); draw(); };
    window.addEventListener('nimeku:accent', onAccent);
    Promise.all([document.fonts?.load(`700 20px ${head}`), document.fonts?.load(`500 12px ${head}`)]).then(() => draw()).catch(() => {});

    const built = new Map();
    const load = (src) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { built.delete(im); draw(); };
      if (src) im.src = src;
      return im;
    };
    const imgs = slides.map((sl) => load(sl.img));
    const posters = slides.map((sl) => (sl.poster && sl.poster !== sl.img ? load(sl.poster) : null));
    // Latar buram: gambar dikecilkan sekali saja, lalu diperbesar halus (murah, tanpa filter blur)
    const blurOf = (im) => {
      if (!(im.complete && im.naturalWidth)) return null;
      if (built.has(im)) return built.get(im);
      const c = document.createElement('canvas');
      c.width = 56; c.height = 35;
      const k = Math.max(56 / im.naturalWidth, 35 / im.naturalHeight);
      c.getContext('2d').drawImage(im, (56 - im.naturalWidth * k) / 2, (35 - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
      built.set(im, c);
      return c;
    };
    // Gambar menutup kotak (seperti object-cover), zoom > 1 memperbesar dari tengah
    const cover = (im, x, y, bw, bh, zoom = 1) => {
      const k = Math.max(bw / im.naturalWidth, bh / im.naturalHeight) * zoom;
      const iw = im.naturalWidth * k, ih = im.naturalHeight * k;
      ctx.drawImage(im, x + (bw - iw) / 2, y + (bh - ih) / 2, iw, ih);
    };

    let w = 0, h = 0, idx = 0, prev = -1, elapsed = 0, fade = 1, T = 0;
    let held = false, visible = true, raf = 0, last = 0, down = null, target = null, navTimer = 0;
    let pressW = 0, pressD = 0;
    const rects = { watch: null, detail: null }; // posisi tombol (px kanvas) untuk deteksi ketukan
    const n = slides.length;
    const unit = () => Math.max(0.8, Math.min(1.5, w / 380));

    // Tata letak bersama: semua elemen mengacu ke angka-angka ini supaya sejajar
    const layout = () => {
      const u = unit();
      const P = 16 * u;
      const top = P;
      const bottom = h - 24 * u; // sisa ruang di bawah untuk penanda slide
      const H = bottom - top;
      const pw = Math.min(H * 0.68, w * 0.33);
      const px = w - P - pw;
      return { u, P, top, bottom, H, pw, px, colX: P, colW: px - 18 * u - P };
    };

    // Latar satu slide: sampul diburamkan, zoom dan geser pelan selama slide tampil
    const paintBg = (i, alpha, t) => {
      const im = imgs[i];
      ctx.save();
      ctx.globalAlpha = alpha;
      const bg = blurOf(im);
      if (bg) {
        const kb = 1.1 + (anim ? 0.08 * t : 0);
        const bw = w * kb, bh = h * kb;
        ctx.drawImage(bg, (w - bw) / 2 + (anim ? (t - 0.5) * w * 0.04 : 0), (h - bh) / 2, bw, bh);
      } else { ctx.fillStyle = '#221b45'; ctx.fillRect(0, 0, w, h); }
      ctx.restore();
    };

    // Isi satu slide. ea = lama slide tampil (ms) untuk animasi masuk; alpha dan dx dipakai saat slide keluar
    const paintContent = (i, alpha, ea, t, dx = 0) => {
      const s = slides[i];
      const im = imgs[i];
      const pim = posters[i] && posters[i].complete && posters[i].naturalWidth ? posters[i] : im;
      const { u, P, top, bottom, H, pw, px, colX, colW } = layout();
      const t0 = 150; // teks baru mulai masuk setelah teks lama hampir hilang
      const step = (from, dur) => ease((ea - t0 - from) / dur);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(dx, 0);

      // poster: sejajar dengan atas dan bawah kolom teks
      const pe = ease((ea - 40) / 700);
      ctx.save();
      ctx.globalAlpha = alpha * pe;
      const pcx = px + pw / 2 + (1 - pe) * 34 * u, pcy = top + H / 2, sc = 0.95 + 0.05 * pe;
      ctx.translate(pcx, pcy);
      ctx.scale(sc, sc);
      ctx.translate(-pw / 2, -H / 2);
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = 18 * u;
      ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#342b63';
      box(ctx, 0, 0, pw, H, 10 * u); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.save();
      box(ctx, 0, 0, pw, H, 10 * u); ctx.clip();
      if (pim.complete && pim.naturalWidth) cover(pim, 0, 0, pw, H, 1.02 + (anim ? 0.06 * t : 0));
      if (anim) { // kilau miring: lewat sekitar satu detik, lalu jeda beberapa detik
        const ph = (T % 6500) / 900;
        if (ph < 1) {
          ctx.save();
          ctx.translate((ph * 1.7 - 0.35) * pw, 0);
          ctx.transform(1, 0, -0.35, 1, 0, 0);
          const sg = ctx.createLinearGradient(-14 * u, 0, 14 * u, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)');
          sg.addColorStop(0.5, 'rgba(255,255,255,.26)');
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = sg;
          ctx.fillRect(-14 * u, 0, 28 * u, H);
          ctx.restore();
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.lineWidth = 1;
      box(ctx, 0.5, 0.5, pw - 1, H - 1, 10 * u); ctx.stroke();
      ctx.restore();

      // ---- kolom teks, semua rata kiri di colX ----
      const labFs = 11 * u, fs = 27 * u, lh = fs * 1.04, pillH = 20 * u, metaFs = 10 * u, btnH = 28 * u;
      let y = top;

      // label: garis aksen + jenis + waktu rilis
      const lp = step(0, 380);
      ctx.save();
      ctx.globalAlpha = alpha * lp;
      ctx.translate((1 - lp) * -14 * u, 0);
      ctx.fillStyle = accent;
      ctx.fillRect(colX, y + labFs * 0.5 - 1 * u, 14 * u * lp, 2 * u);
      ctx.font = `500 ${labFs}px ${head}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.8px';
      ctx.textAlign = 'left';
      const type = String(s.type || 'ANIME').toUpperCase();
      ctx.fillStyle = accent;
      ctx.fillText(type, colX + 22 * u, y + labFs * 0.9);
      const rest = s.ago ? `RILIS ${String(s.ago).toUpperCase()}` : 'TERBARU';
      ctx.fillStyle = '#cfc8ee';
      const restX = colX + 22 * u + ctx.measureText(`${type}   `).width;
      ctx.fillText(wrapText(ctx, rest, Math.max(10, colX + colW - restX), 1)[0] || '', restX, y + labFs * 0.9);
      ctx.restore();
      y += labFs + 10 * u;

      // judul: tiap baris naik dari balik garis, bergantian
      ctx.font = `700 ${fs}px ${head}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.4px';
      const lines = wrapText(ctx, String(s.title).toUpperCase(), colW, 2);
      ctx.fillStyle = '#f6f1ff';
      lines.forEach((ln, k) => {
        const p = step(80 + k * 100, 520);
        ctx.save();
        ctx.beginPath(); ctx.rect(colX - 4 * u, y + k * lh, colW + 8 * u, lh * 1.1); ctx.clip();
        ctx.fillText(ln, colX, y + k * lh + fs * 0.86 + (1 - p) * fs * 1.1);
        ctx.restore();
      });
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      y += lines.length * lh + 12 * u;

      // baris info: nomor episode, nilai, genre (satu tinggi dan satu garis dasar; yang tidak muat dilewati)
      const genres = Array.isArray(s.genres) && s.genres.length ? s.genres : s.genre ? [s.genre] : [];
      const pills = [s.ep ? { t: `EP ${s.ep}`, kind: 'ep' } : null, s.rating ? { t: `★ ${s.rating}`, kind: 'rate' } : null, ...genres.slice(0, 2).map((g) => ({ t: String(g).toUpperCase(), kind: 'g' }))].filter(Boolean);
      ctx.font = `500 ${10.5 * u}px ${head}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.8px';
      let cx = colX;
      pills.forEach((pl, i) => {
        const cw = ctx.measureText(pl.t).width + 18 * u;
        if (cx + cw > colX + colW + 1) return;
        const pp = step(330 + i * 80, 360);
        ctx.save();
        ctx.globalAlpha = alpha * pp;
        ctx.translate(0, (1 - pp) * 6 * u);
        if (pl.kind === 'ep') {
          ctx.fillStyle = accent;
          box(ctx, cx, y, cw, pillH, 5 * u); ctx.fill();
          ctx.fillStyle = `rgb(${INK})`;
        } else {
          ctx.strokeStyle = pl.kind === 'rate' ? 'rgba(255,200,87,.7)' : 'rgba(246,241,255,.4)';
          ctx.lineWidth = 1;
          box(ctx, cx + 0.5, y + 0.5, cw - 1, pillH - 1, 5 * u); ctx.stroke();
          ctx.fillStyle = pl.kind === 'rate' ? LANTERN : '#f6f1ff';
        }
        ctx.fillText(pl.t, cx + 9 * u, y + pillH * 0.68);
        ctx.restore();
        cx += cw + 6 * u;
      });
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      y += pillH + 9 * u;

      // studio dan jumlah penonton
      const meta = [s.studio, s.views > 0 ? `${compact(s.views)} ditonton` : ''].filter(Boolean).join('  ·  ');
      if (meta) {
        ctx.save();
        ctx.globalAlpha = alpha * step(560, 400);
        ctx.font = `600 ${metaFs}px ${sans}`;
        ctx.fillStyle = '#b9b2da';
        ctx.fillText(wrapText(ctx, meta, colW, 1)[0] || '', colX, y + metaFs * 0.85);
        ctx.restore();
      }

      // tombol: sejajar dengan bawah poster
      const btnY = bottom - btnH;
      ctx.font = `600 ${11.5 * u}px ${head}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
      const wl = ctx.measureText('TONTON').width, dl = ctx.measureText('DETAIL').width;
      const bw1 = wl + 42 * u, bw2 = dl + 28 * u;
      const bx1 = colX, bx2 = bx1 + bw1 + 8 * u;
      rects.watch = { x: bx1 + dx, y: btnY, w: bw1, h: btnH };
      rects.detail = { x: bx2 + dx, y: btnY, w: bw2, h: btnH };

      const b1 = step(420, 450), b2 = step(490, 450);
      ctx.save();
      ctx.globalAlpha = alpha * b1;
      ctx.translate(bx1 + bw1 / 2, btnY + btnH / 2 + (1 - b1) * 10 * u);
      ctx.scale(1 - 0.06 * pressW, 1 - 0.06 * pressW);
      ctx.fillStyle = LANTERN;
      box(ctx, -bw1 / 2, -btnH / 2, bw1, btnH, btnH / 2); ctx.fill();
      if (anim) {
        const sp = ((T + 1400) % 4200) / 700;
        if (sp < 1) {
          ctx.save();
          box(ctx, -bw1 / 2, -btnH / 2, bw1, btnH, btnH / 2); ctx.clip();
          ctx.translate(-bw1 / 2 + (sp * 1.6 - 0.3) * bw1, 0);
          ctx.transform(1, 0, -0.4, 1, 0, 0);
          const g = ctx.createLinearGradient(-8 * u, 0, 8 * u, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, 'rgba(255,255,255,.6)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(-8 * u, -btnH / 2, 16 * u, btnH);
          ctx.restore();
        }
      }
      ctx.fillStyle = `rgb(${INK})`;
      ctx.beginPath();
      ctx.moveTo(-bw1 / 2 + 14 * u, -5 * u); ctx.lineTo(-bw1 / 2 + 14 * u, 5 * u); ctx.lineTo(-bw1 / 2 + 22 * u, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillText('TONTON', -bw1 / 2 + 28 * u, 4.2 * u);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alpha * b2;
      ctx.translate(bx2 + bw2 / 2, btnY + btnH / 2 + (1 - b2) * 10 * u);
      ctx.scale(1 - 0.06 * pressD, 1 - 0.06 * pressD);
      ctx.strokeStyle = 'rgba(246,241,255,.6)';
      ctx.lineWidth = 1.5 * u;
      box(ctx, -bw2 / 2, -btnH / 2, bw2, btnH, btnH / 2); ctx.stroke();
      ctx.fillStyle = '#f6f1ff';
      ctx.fillText('DETAIL', -bw2 / 2 + 14 * u, 4.2 * u);
      ctx.restore();
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

      ctx.restore();
    };

    function draw() {
      if (!w) return;
      const { u, P } = layout();
      const t = Math.min(elapsed / SLIDE_MS, 1);
      ctx.clearRect(0, 0, w, h);

      // latar (saling memudar), lalu penggelap yang sama untuk semua slide agar teks mudah dibaca
      if (prev >= 0 && fade < 1) paintBg(prev, 1, 1);
      paintBg(idx, prev >= 0 && fade < 1 ? ease(fade) : 1, t);
      ctx.fillStyle = `rgba(${INK},.55)`;
      ctx.fillRect(0, 0, w, h);
      const sh = ctx.createLinearGradient(0, 0, w * 0.8, 0);
      sh.addColorStop(0, `rgba(${INK},.6)`);
      sh.addColorStop(1, `rgba(${INK},0)`);
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, w, h);
      const vg = ctx.createLinearGradient(0, h * 0.6, 0, h);
      vg.addColorStop(0, `rgba(${INK},0)`);
      vg.addColorStop(1, `rgba(${INK},.55)`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);

      // teks lama memudar dan bergeser sedikit dalam ~40% awal transisi, teks baru baru masuk setelahnya
      if (prev >= 0 && fade < 1) {
        const o = clamp01(fade / 0.4);
        if (o < 1) paintContent(prev, 1 - o, 1e9, 1, -12 * u * ease(o));
      }
      paintContent(idx, 1, reduce ? 1e9 : elapsed, t);

      // penanda slide: bilah sejajar dengan kolom teks, penghitung di ujung kanan sejajar dengan tepi poster
      const y = h - 14 * u;
      const cw = 36 * u;
      const total = w - 2 * P - cw, seg = (total - (n - 1) * 4) / n;
      for (let k = 0; k < n; k++) {
        const x = P + k * (seg + 4);
        ctx.fillStyle = 'rgba(246,241,255,.26)';
        ctx.fillRect(x, y, seg, 3);
        if (k === idx) { ctx.fillStyle = accent; ctx.fillRect(x, y, seg * (reduce ? 1 : t), 3); }
      }
      ctx.font = `500 ${10 * u}px ${head}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.2px';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#b9b2da';
      ctx.fillText(`${String(idx + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`, w - P, y + 5 * u);
      ctx.textAlign = 'left';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }

    const go = (d) => { prev = idx; idx = (idx + d + n) % n; elapsed = 0; fade = reduce ? 1 : 0; draw(); };

    // ~30 gambar per detik; berhenti total saat tersembunyi atau di luar layar
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 100);
      if (dt < (reduce ? 250 : 32)) return;
      last = now;
      if (anim) T += dt;
      if (!held) elapsed += dt;
      if (fade < 1) fade = Math.min(1, fade + dt / FADE_MS);
      const k = Math.min(1, dt / 70);
      pressW += ((held && target === 'watch' ? 1 : 0) - pressW) * k;
      pressD += ((held && target === 'detail' ? 1 : 0) - pressD) * k;
      if (n > 1 && elapsed >= SLIDE_MS) { go(1); return; }
      if (!reduce) draw();
    };
    const run = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (visible && !document.hidden ? run() : stop());

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = holder.clientWidth;
      h = Math.round(w * 0.56);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    // tombol mana yang tersentuh (area diperluas 4px agar mudah diketuk)
    const which = (x, y) => {
      for (const k of ['watch', 'detail']) {
        const r = rects[k];
        if (r && x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4) return k;
      }
      return null;
    };
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    const onDown = (e) => { const p = pos(e); down = e.clientX; target = which(p.x, p.y); held = true; };
    const onUp = (e) => {
      const was = target;
      held = false; target = null;
      if (down == null) return;
      const dx = e.clientX - down;
      down = null;
      if (dx > 45) { go(-1); return; }
      if (dx < -45) { go(1); return; }
      const hit = which(pos(e).x, pos(e).y);
      // hanya tombol yang membuka halaman; ketukan di tempat lain tidak ke mana-mana
      if (hit && hit === was) {
        const s = slides[idx];
        const href = hit === 'watch' ? s.watch || s.href : s.href;
        clearTimeout(navTimer);
        navTimer = setTimeout(() => router.push(href), reduce ? 0 : 180);
      }
    };
    const onCancel = () => { down = null; held = false; target = null; };
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'Enter') router.push(slides[idx].watch || slides[idx].href);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(holder);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; onVis(); });
    io.observe(holder);
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('keydown', onKey);
    resize();
    run();

    return () => {
      stop();
      clearTimeout(navTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('nimeku:accent', onAccent);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('keydown', onKey);
    };
  }, [slides, router]);

  return (
    <div ref={wrap} className="w-full reveal">
      <canvas ref={cv} tabIndex={0} role="img" aria-label={`Rilis terbaru: ${slides.map((s) => s.title).join(', ')}`}
        className="block w-full aspect-[100/56] rounded-3xl ring-1 ring-edge bg-night touch-pan-y select-none" />
      {/* daftar tautan untuk pembaca layar */}
      <ul className="sr-only">
        {slides.map((s) => (
          <li key={s.id}>
            <Link href={s.watch || s.href}>Tonton {s.title}{s.ep ? `, episode ${s.ep}` : ''}</Link>
            <Link href={s.href}>Detail {s.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
