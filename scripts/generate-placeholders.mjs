// Branded placeholder generator for Salt Grass Modular.
// Produces real raster files (JPEG/PNG) at every image path the site
// references, so the preview looks intentional. Real photos later overwrite
// the same paths — no code changes needed. Run: node scripts/generate-placeholders.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

const CRIMSON = '#C41E3A';
const NAVY = '#1a1a2e';

// title-case a kebab filename → human label
function humanize(name) {
  const overrides = {
    'hero-modular-home': 'Custom Modular Homes',
    'hero-default': 'Saltgrass Modular',
    'dylan-portrait': 'Dylan Walker',
    'facility-tour': 'Our Facility',
    'og-default': 'Saltgrass Modular',
    'container-home-interior': 'Container Home Interior',
    'traditional-home-exterior': 'Traditional Build',
    'pools-models-hero': 'Modular Pools',
    'saltgrass-101-hero': 'Saltgrass 101',
    'development-project': 'Development Project',
  };
  if (overrides[name]) return overrides[name];
  return name
    .replace(/-hero$/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// escape text for safe insertion into SVG/XML
function xml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build a branded SVG. variant: 'hero' | 'portrait' | 'og' | 'mark'
function svg({ w, h, label, sublabel, variant }) {
  label = xml(label);
  sublabel = xml(sublabel);
  const titleSize = variant === 'og' ? Math.round(w * 0.06)
    : variant === 'mark' ? Math.round(w * 0.30)
    : Math.round(Math.min(w, h) * 0.07);
  const subSize = Math.round(titleSize * 0.42);
  const cx = w / 2, cy = h / 2;

  // subtle "modular blocks" motif — translucent rectangles suggesting stacked modules
  const blocks = [];
  if (variant !== 'mark') {
    const bw = w * 0.14, bh = h * 0.16;
    const positions = [
      [w * 0.08, h * 0.62], [w * 0.08 + bw * 1.1, h * 0.62], [w * 0.08 + bw * 2.2, h * 0.62],
      [w * 0.70, h * 0.12], [w * 0.70 + bw * 1.1, h * 0.12],
    ];
    for (const [x, y] of positions) {
      blocks.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" rx="${(bw*0.06).toFixed(0)}" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"/>`);
    }
  }

  const mark = variant === 'mark'
    ? `<text x="${cx}" y="${cy}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="central" letter-spacing="2">SM</text>`
    : `
      <text x="${cx}" y="${variant === 'portrait' ? cy + h*0.10 : cy - subSize*0.3}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="${(titleSize*0.04).toFixed(1)}">${label}</text>
      ${sublabel ? `<text x="${cx}" y="${(variant === 'portrait' ? cy + h*0.10 : cy - subSize*0.3) + titleSize*0.95}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" font-weight="400" fill="#ffffff" fill-opacity="0.85" text-anchor="middle" letter-spacing="1">${sublabel}</text>` : ''}
      <rect x="${cx - w*0.04}" y="${(variant === 'portrait' ? cy + h*0.10 : cy - subSize*0.3) - titleSize*0.8}" width="${w*0.08}" height="3" fill="${CRIMSON}"/>
    `;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${CRIMSON}"/>
      <stop offset="55%" stop-color="#6b1226"/>
      <stop offset="100%" stop-color="${NAVY}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  ${blocks.join('\n  ')}
  ${variant !== 'mark' ? `<text x="${cx}" y="${h*0.12}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize*0.8}" font-weight="700" fill="#ffffff" fill-opacity="0.7" text-anchor="middle" letter-spacing="4">SALTGRASS MODULAR</text>` : ''}
  ${mark}
</svg>`);
}

// path (relative to public/) → spec
const ASSETS = [
  // brand / utility
  { path: 'logo.png', w: 512, h: 512, variant: 'mark', fmt: 'png' },
  { path: 'apple-touch-icon.png', w: 180, h: 180, variant: 'mark', fmt: 'png' },
  { path: 'img/og-default.jpg', w: 1200, h: 630, variant: 'og', label: 'Saltgrass Modular', sublabel: 'Custom Modular Homes, Pools & Rapid-Deployment Housing', fmt: 'jpg' },
  // portrait
  { path: 'img/dylan-portrait.jpg', w: 800, h: 1000, variant: 'portrait', label: 'Dylan Walker', sublabel: 'Founder & Owner', fmt: 'jpg' },
];

// every other /img/*.jpg hero/content image
const HERO_NAMES = [
  'about-hero', 'contact-hero', 'container-home-interior', 'container-homes-hero',
  'developers-hero', 'development-project', 'disaster-relief-hero', 'facility-tour',
  'financing-hero', 'hero-default', 'hero-modular-home', 'homeowners-hero',
  'military-hero', 'models-hero', 'pools-hero', 'pools-models-hero', 'process-hero',
  'projects-hero', 'saltgrass-101-hero', 'services-hero', 'traditional-builds-hero',
  'traditional-home-exterior',
];
for (const name of HERO_NAMES) {
  ASSETS.push({ path: `img/${name}.jpg`, w: 1600, h: 1067, variant: 'hero', label: humanize(name), sublabel: 'Saltgrass Modular', fmt: 'jpg' });
}

let count = 0;
for (const a of ASSETS) {
  const buf = svg({ w: a.w, h: a.h, label: a.label, sublabel: a.sublabel, variant: a.variant });
  const out = join(PUBLIC, a.path);
  await mkdir(dirname(out), { recursive: true });
  const pipeline = sharp(buf, { density: 144 });
  const data = a.fmt === 'png'
    ? await pipeline.png({ quality: 90 }).toBuffer()
    : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  await writeFile(out, data);
  count++;
  console.log(`  ${(data.length / 1024).toFixed(0).padStart(4)} KB  ${a.path}  (${a.w}x${a.h})`);
}
console.log(`\nGenerated ${count} branded placeholder assets into public/.`);
