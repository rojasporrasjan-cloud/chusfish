// ════════════════════════════════════════════════════════════════
//  Chus's Fish — Optimizador de imágenes (jimp)
//  Reduce el peso de las imágenes pesadas manteniendo la calidad visual.
//  Uso:  node optimize-images.js
//
//  - selorecomiendo.png  → se redimensiona y se sobrescribe (logo, sigue PNG).
//  - assets/*.png opacas  → se crean .jpg optimizados (se conservan los .png).
// ════════════════════════════════════════════════════════════════
const { Jimp } = require('jimp');
const fs = require('fs');

const KB = n => (n / 1024).toFixed(0) + ' KB';

const jobs = [
  // Logo con texto → mantener PNG (JPEG le metería artefactos al texto). Se muestra a ≤320px.
  { in: 'selorecomiendo.png',        out: 'selorecomiendo.png',          maxW: 640,  fmt: 'png' },
  // Fotos opacas → JPEG (gran ahorro, calidad visual intacta).
  { in: 'assets/fondo_premium.png',  out: 'assets/fondo_premium.jpg',    maxW: 1024, fmt: 'jpeg', q: 82 },
  { in: 'assets/camion_reparto.png', out: 'assets/camion_reparto.jpg',   maxW: 1024, fmt: 'jpeg', q: 85 },
  { in: 'assets/pargo_entero.png',   out: 'assets/pargo_entero.jpg',     maxW: 1000, fmt: 'jpeg', q: 84 },
  { in: 'assets/ceviche_chus.png',   out: 'assets/ceviche_chus.jpg',     maxW: 1000, fmt: 'jpeg', q: 84 },
  { in: 'assets/filete_corvina.png', out: 'assets/filete_corvina.jpg',   maxW: 1000, fmt: 'jpeg', q: 84 },
  { in: 'assets/camarones_gourmet.png', out: 'assets/camarones_gourmet.jpg', maxW: 1000, fmt: 'jpeg', q: 84 },
];

(async () => {
  let totalBefore = 0, totalAfter = 0;
  for (const job of jobs) {
    if (!fs.existsSync(job.in)) { console.log('— (omitido, no existe):', job.in); continue; }
    const before = fs.statSync(job.in).size;
    const img = await Jimp.read(job.in);
    const { width, height } = img.bitmap;
    if (width > job.maxW) {
      const h = Math.round(height * (job.maxW / width));
      img.resize({ w: job.maxW, h });
    }
    const buf = job.fmt === 'jpeg'
      ? await img.getBuffer('image/jpeg', { quality: job.q })
      : await img.getBuffer('image/png');
    fs.writeFileSync(job.out, buf);
    const after = buf.length;
    totalBefore += before; totalAfter += after;
    const pct = Math.round((1 - after / before) * 100);
    console.log(`${job.out.padEnd(34)} ${KB(before).padStart(8)} → ${KB(after).padStart(8)}  (-${pct}%)`);
  }
  console.log('─'.repeat(60));
  console.log(`TOTAL  ${KB(totalBefore)} → ${KB(totalAfter)}  (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
