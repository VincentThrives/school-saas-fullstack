const sharp = require('sharp');
const path = require('path');

const ICON_SVG = path.join(__dirname, '..', 'resources', 'icon.png');
const OUT = path.join(__dirname, '..', '..', 'NammaVidyalaya-FeatureGraphic-1024x500.png');

const W = 1024;
const H = 500;
const ICON_SIZE = 320;
const ICON_LEFT = 30;
const TEXT_X = 380;

const overlay = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2A3D8F"/>
      <stop offset="100%" stop-color="#1B2660"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="200" cy="250" r="220" fill="#3A4FB0" opacity="0.22"/>
  <text x="${TEXT_X}" y="220" font-family="Inter, Segoe UI, Roboto, sans-serif" font-size="60" font-weight="800" fill="#FFFFFF" letter-spacing="-1">Namma Vidyalaya</text>
  <text x="${TEXT_X}" y="270" font-family="Inter, Segoe UI, Roboto, sans-serif" font-size="26" font-weight="500" fill="#FFD15C">Smart School Management</text>
  <line x1="${TEXT_X}" y1="298" x2="${TEXT_X + 80}" y2="298" stroke="#F5A623" stroke-width="4" stroke-linecap="round"/>
  <text x="${TEXT_X}" y="345" font-family="Inter, Segoe UI, Roboto, sans-serif" font-size="20" font-weight="400" fill="#D8DEF4">For Parents, Students &amp; Teachers</text>
</svg>
`;

(async () => {
  const iconBuf = await sharp(ICON_SVG).resize(ICON_SIZE, ICON_SIZE).png().toBuffer();
  await sharp(Buffer.from(overlay))
    .composite([{ input: iconBuf, left: ICON_LEFT, top: Math.round((H - ICON_SIZE) / 2) }])
    .png()
    .toFile(OUT);
  console.log('Wrote', OUT);
})();
