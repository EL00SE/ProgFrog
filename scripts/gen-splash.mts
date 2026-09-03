/**
 * iOS PWA launch screens. Renders the frog mark centred on the brand-green
 * ground at each common iPhone resolution, so an installed app opens onto a
 * branded splash instead of a white flash.
 *   npx tsx scripts/gen-splash.mts
 * The <link rel="apple-touch-startup-image"> entries are in src/app/layout.tsx
 * (metadata.appleWebApp.startupImage) — keep the device list there in sync.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const BG = "#14110c";
const root = process.cwd();
const outDir = join(root, "public", "splash");
mkdirSync(outDir, { recursive: true });

const markSvg = readFileSync(join(root, "src", "app", "icon.svg"));

// Portrait CSS points × device-pixel-ratio → actual pixels.
const devices: { w: number; h: number; r: number }[] = [
  { w: 375, h: 667, r: 2 }, // SE 2/3, 8, 7, 6s
  { w: 414, h: 736, r: 3 }, // 8 Plus
  { w: 375, h: 812, r: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, r: 2 }, // XR, 11
  { w: 414, h: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 390, h: 844, r: 3 }, // 12, 12 Pro, 13, 13 Pro, 14
  { w: 428, h: 926, r: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 393, h: 852, r: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 430, h: 932, r: 3 }, // 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  { w: 402, h: 874, r: 3 }, // 16 Pro
  { w: 440, h: 956, r: 3 }, // 16 Pro Max
];

for (const { w, h, r } of devices) {
  const pw = w * r;
  const ph = h * r;
  const mark = await sharp(markSvg, { density: 384 })
    .resize(Math.round(Math.min(pw, ph) * 0.32))
    .png()
    .toBuffer();

  await sharp({
    create: { width: pw, height: ph, channels: 4, background: BG },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(join(outDir, `${pw}x${ph}.png`));

  console.log(`  public/splash/${pw}x${ph}.png`);
}
