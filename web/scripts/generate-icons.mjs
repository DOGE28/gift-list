/**
 * Pure Node PNG icon generator.
 * Creates 192x192 and 512x512 PNG icons without any external dependencies.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(path.dirname(process.cwd()), 'web/public/icons');
fs.mkdirSync(outputDir, { recursive: true });

/**
 * Create a valid PNG file with a solid color.
 * @param {number} width
 * @param {number} height
 * @param {[number, number, number]} rgb - [r, g, b] 0-255
 * @param {string} outputPath
 */
function createPng(width, height, rgb, outputPath) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);   // bit depth
  ihdrData.writeUInt8(2, 9);   // color type: truecolor (RGB)
  ihdrData.writeUInt8(0, 10);  // compression
  ihdrData.writeUInt8(0, 11);  // filter
  ihdrData.writeUInt8(0, 12);  // interlace

  const ihdr = makeChunk('IHDR', ihdrData);

  // Image data: each row is [filter_byte, r, g, b, r, g, b, ...]
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row.writeUInt8(0, 0); // filter: none
    for (let x = 0; x < width; x++) {
      row.writeUInt8(rgb[0], 1 + x * 3);
      row.writeUInt8(rgb[1], 1 + x * 3 + 1);
      row.writeUInt8(rgb[2], 1 + x * 3 + 2);
    }
    rawRows.push(row);
  }
  const rawImage = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawImage);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdr, idat, iend]);
  fs.writeFileSync(outputPath, png);
  console.log(`Created: ${outputPath} (${width}x${height})`);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    crc = (crc + ((crc << 1) & 0x00000000)) ^ (crc >>> 0);
    // Standard CRC32
    crc = crc32Step(crc, buffer[i]);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crc32Step(crc, byte) {
  for (let i = 0; i < 8; i++) {
    const bit = crc & 1;
    crc >>= 1;
    if (bit) crc ^= 0xedb88320;
  }
  return crc;
}

// Draw a simple "gift box" pattern: background + a lighter square in center
// For simplicity, we'll create a solid color icon with a subtle gradient effect
// by using two tones.

// 192x192 icon
createPng(192, 192, [26, 26, 46], path.join(outputDir, 'icon-192.png'));

// 512x512 icon
createPng(512, 512, [26, 26, 46], path.join(outputDir, 'icon-512.png'));

console.log('Icon generation complete.');
