import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function createIconSvg(size, padding) {
  const iconSize = size - padding * 2;
  const radius = Math.round(size * 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#140d09"/>
    <g transform="translate(${padding}, ${padding})">
      <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="#c9a066" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 8 L7 12 L12 6 L17 12 L21 8 L20 18 L4 18 Z"/>
        <circle cx="3" cy="7" r="1" fill="#c9a066"/>
        <circle cx="12" cy="5" r="1" fill="#c9a066"/>
        <circle cx="21" cy="7" r="1" fill="#c9a066"/>
        <path d="M4 18 L20 18" stroke-width="2"/>
      </svg>
    </g>
  </svg>`;
}

function createOgSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#140d09"/>
    <g transform="translate(500, 120)">
      <svg viewBox="0 0 24 24" width="200" height="200" fill="none" stroke="#c9a066" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 8 L7 12 L12 6 L17 12 L21 8 L20 18 L4 18 Z"/>
        <circle cx="3" cy="7" r="1" fill="#c9a066"/>
        <circle cx="12" cy="5" r="1" fill="#c9a066"/>
        <circle cx="21" cy="7" r="1" fill="#c9a066"/>
        <path d="M4 18 L20 18" stroke-width="2"/>
      </svg>
    </g>
    <text x="600" y="380" text-anchor="middle" font-family="serif" font-size="72" font-weight="bold" letter-spacing="16" fill="#c9a066">RULERS</text>
    <text x="600" y="430" text-anchor="middle" font-family="serif" font-size="24" letter-spacing="8" fill="#8a7a5a">CONQUEST  ·  POLITICS  ·  CIVILIZATION</text>
    <line x1="440" y1="470" x2="760" y2="470" stroke="#c9a066" stroke-width="0.5" opacity="0.4"/>
  </svg>`;
}

const icons = [
  { name: "apple-icon.png", size: 180, padding: 28, dest: "src/app" },
  { name: "icon.png", size: 192, padding: 30, dest: "src/app" },
  { name: "icon-512.png", size: 512, padding: 80, dest: "public" },
];

for (const { name, size, padding, dest } of icons) {
  const svg = createIconSvg(size, padding);
  await sharp(Buffer.from(svg)).png().toFile(resolve(root, dest, name));
  console.log(`✓ ${dest}/${name} (${size}x${size})`);
}

const ogSvg = createOgSvg();
await sharp(Buffer.from(ogSvg)).png().toFile(resolve(root, "public/og-image.png"));
console.log("✓ public/og-image.png (1200x630)");
