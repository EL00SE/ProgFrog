/**
 * Rasterises the frog mark into the PNG sizes the web-app manifest and iOS need.
 * Run after changing any of the source SVGs:  npx tsx scripts/gen-icons.mts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const pub = join(process.cwd(), "public");
const appDir = join(process.cwd(), "src", "app");

const any = readFileSync(join(appDir, "icon.svg"));
const maskable = readFileSync(join(pub, "icon-maskable.svg"));

// [source svg, size, output dir, filename]
const jobs: [Buffer, number, string, string][] = [
  [any, 192, pub, "icon-192.png"],
  [any, 512, pub, "icon-512.png"],
  [maskable, 512, pub, "icon-maskable-512.png"],
  // iOS home-screen icon — picked up by the src/app/apple-icon.png convention.
  [maskable, 180, appDir, "apple-icon.png"],
];

for (const [svg, size, dir, name] of jobs) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png()
    .toFile(join(dir, name));
  console.log(`  ${dir === pub ? "public" : "src/app"}/${name}  ${size}x${size}`);
}
