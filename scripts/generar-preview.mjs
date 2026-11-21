import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
const svg = await readFile('public/invitacion-whatsapp.svg');
await mkdir('public', { recursive: true });
await sharp(svg, { density: 96 })
  .resize({ width: 1200, height: 630, fit: 'fill' })
  .png({ compressionLevel: 9, palette: true })
  .toFile('public/invitacion-whatsapp.png');
console.log('Vista previa de WhatsApp generada (1200 × 630).');
