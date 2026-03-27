/**
 * Generate PWA icon PNG files programmatically.
 * Creates valid PNG files with the Stride brand colors:
 *   - Background: #E8C547 (gold accent)
 *   - Foreground: #0A0A0A (dark)
 *
 * Uses raw PNG encoding (no external dependencies).
 * Icons are simple solid-color squares - placeholder quality.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, bgColor, fgColor, letter, isMaskable) {
  // Each row: filter byte (0) + width * 3 bytes (RGB)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  const [bgR, bgG, bgB] = bgColor;
  const [fgR, fgG, fgB] = fgColor;

  // Simple bitmap font for "S" - scaled to icon size
  const fontSize = Math.floor(width * 0.5);
  const offsetX = Math.floor((width - fontSize * 0.6) / 2);
  const offsetY = Math.floor((height - fontSize) / 2);

  // Maskable icons need safe area padding (10% on each side)
  const safeMargin = isMaskable ? Math.floor(width * 0.1) : 0;

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawData[rowStart] = 0; // No filter

    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;

      // Check if this pixel should be part of the "S" letter
      const relX = (x - offsetX - safeMargin) / fontSize;
      const relY = (y - offsetY - safeMargin) / fontSize;

      let isLetter = false;
      if (relX >= 0 && relX <= 0.6 && relY >= 0 && relY <= 1.0) {
        const thickness = 0.16;
        // Top horizontal bar
        if (relY >= 0 && relY <= thickness && relX >= 0.05 && relX <= 0.55) isLetter = true;
        // Left vertical (top half)
        if (relX >= 0.05 && relX <= 0.05 + thickness && relY >= 0 && relY <= 0.5) isLetter = true;
        // Middle horizontal bar
        if (relY >= 0.42 && relY <= 0.42 + thickness && relX >= 0.05 && relX <= 0.55) isLetter = true;
        // Right vertical (bottom half)
        if (relX >= 0.55 - thickness && relX <= 0.55 && relY >= 0.42 && relY <= 1.0) isLetter = true;
        // Bottom horizontal bar
        if (relY >= 1.0 - thickness && relY <= 1.0 && relX >= 0.05 && relX <= 0.55) isLetter = true;
      }

      if (isLetter) {
        rawData[pixelStart] = fgR;
        rawData[pixelStart + 1] = fgG;
        rawData[pixelStart + 2] = fgB;
      } else {
        rawData[pixelStart] = bgR;
        rawData[pixelStart + 1] = bgG;
        rawData[pixelStart + 2] = bgB;
      }
    }
  }

  // Compress the raw data
  const compressed = zlib.deflateSync(rawData);

  // Build PNG file
  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT chunk
  chunks.push(makeChunk('IDAT', compressed));

  // IEND chunk
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const bgColor = [0xE8, 0xC5, 0x47]; // #E8C547
const fgColor = [0x0A, 0x0A, 0x0A]; // #0A0A0A

// 192x192
const icon192 = createPNG(192, 192, bgColor, fgColor, 'S', false);
fs.writeFileSync(path.join(outDir, 'icon-192.png'), icon192);
console.log('Created icon-192.png (%d bytes)', icon192.length);

// 512x512
const icon512 = createPNG(512, 512, bgColor, fgColor, 'S', false);
fs.writeFileSync(path.join(outDir, 'icon-512.png'), icon512);
console.log('Created icon-512.png (%d bytes)', icon512.length);

// 512x512 maskable (with safe area padding)
const iconMaskable = createPNG(512, 512, bgColor, fgColor, 'S', true);
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), iconMaskable);
console.log('Created icon-maskable-512.png (%d bytes)', iconMaskable.length);

console.log('All icons generated successfully.');
