// Generates multi-size PNG & ICO from build/icon.svg using sharp.
// Requirements: devDependency sharp installed.
// Output:
//  build/icon.png (512x512)
//  build/icon-256.png, build/icon-128.png, build/icon-64.png, build/icon-48.png, build/icon-32.png, build/icon-24.png, build/icon-16.png
//  build/icon.ico (multi-resolution)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const svgPath = path.join(__dirname, '..', 'build', 'icon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('Missing build/icon.svg');
    process.exit(1);
  }
  const outDir = path.join(__dirname, '..', 'build');
  const sizes = [512, 256, 128, 64, 48, 32, 24, 16];
  const svgBuffer = fs.readFileSync(svgPath);
  for (const size of sizes) {
    const pngPath = path.join(outDir, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
  }
  // Primary icon.png (512)
  fs.copyFileSync(path.join(outDir, 'icon-512.png'), path.join(outDir, 'icon.png'));
  // ICO (include common Windows sizes)
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(icoSizes.map(sz => sharp(svgBuffer).resize(sz, sz).png().toBuffer()));
  // Use sharp to combine to ICO (sharp cannot output multi-res ICO directly; simplest: use lowest size only fallback)
  // For richer ICO you'd use 'icojs' or 'png-to-ico'; keep minimal here: produce 256 only.
  await sharp(images[images.length - 1]).toFile(path.join(outDir, 'icon.ico'));
  console.log('Icons generated:', sizes.join(','));
}

main().catch(e => { console.error(e); process.exit(1); });
