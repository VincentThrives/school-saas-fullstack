/**
 * Render the chosen SVG mockup to a 1024x1024 PNG and a 2732x2732 splash
 * background. The output goes into resources/ where @capacitor/assets
 * picks them up to generate every Android mipmap size automatically.
 *
 * Run from frontend-angular/ via:
 *   node scripts/render-icon.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = 'C:/Users/91789/OneDrive/Desktop/school-app-icons/01-graduation-cap.svg';
const OUT_DIR = path.join(__dirname, '..', 'resources');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const svg = fs.readFileSync(SVG_PATH);

(async () => {
  // Launcher icon source — 1024x1024 is the size @capacitor/assets wants.
  await sharp(svg, { density: 1024 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(OUT_DIR, 'icon.png'));
  console.log('Wrote resources/icon.png (1024x1024)');

  // Splash background — solid dark with the icon centred. We render the
  // SVG at the icon size, then composite it onto a 2732x2732 dark canvas
  // so Android's launch screen looks intentional (the default white is
  // jarring against the gold-on-dark icon).
  const iconForSplash = await sharp(svg, { density: 800 })
    .resize(720, 720)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 2732, height: 2732, channels: 4,
      background: { r: 13, g: 13, b: 13, alpha: 1 }, // matches icon bg #0D0D0D
    },
  })
    .composite([{ input: iconForSplash, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT_DIR, 'splash.png'));
  console.log('Wrote resources/splash.png (2732x2732)');
})();
