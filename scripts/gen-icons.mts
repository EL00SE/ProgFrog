/**
 * Rasterises the frog mark into the PNG sizes the web-app manifest and iOS
 * need, plus a multi-resolution public/favicon.ico for the desktop surfaces
 * that fetch /favicon.ico directly (bookmarks, history, taskbar pins). It sits
 * in public/ rather than app/ on purpose: Next only auto-links an app/
 * favicon, and that link outranks the crisp icon.svg in some browsers — this
 * way the SVG always wins the tab and the .ico just backstops direct requests.
 * Run after changing any of the source SVGs:  npx tsx scripts/gen-icons.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
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

/** Pack a set of PNG buffers into a single .ico (PNG-in-ICO, universally read). */
function pngToIco(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  let offset = header.length + entries.length;
  images.forEach((img, i) => {
    const e = entries.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
    e.writeUInt8(0, 2); // palette size
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(img.data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.data.length;
  });

  return Buffer.concat([header, entries, ...images.map((i) => i.data)]);
}

const icoImages = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    data: await sharp(any, { density: 384 })
      .resize(size, size, { fit: "contain" })
      .png()
      .toBuffer(),
  })),
);
writeFileSync(join(pub, "favicon.ico"), pngToIco(icoImages));
console.log("  public/favicon.ico  16/32/48");
