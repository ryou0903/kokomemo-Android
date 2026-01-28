import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const svgPath = join(publicDir, 'icon.svg');
const svg = readFileSync(svgPath);

const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    const outputPath = join(publicDir, `icon-${size}.png`);
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${outputPath}`);
  }
  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
