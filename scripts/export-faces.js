#!/usr/bin/env node
/**
 * scripts/export-faces.js
 *
 * Exports each pixel-art character face in faces.js to a crisp, standalone SVG
 * in assets/faces/.
 *
 * Usage:
 *   node scripts/export-faces.js          - write all SVGs to assets/faces/
 *   node scripts/export-faces.js --check  - verify assets/faces/*.svg match faces.js
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {FACE_SIZE, FACES} from '../faces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACES_DIR = path.join(__dirname, '../assets/faces');

export function faceToSvg(
  face,
  {background = '#f2d9a6', rx = 2, size = 96} = {}
) {
  const rects = [];
  if (background) {
    rects.push(
      `  <rect width="${FACE_SIZE}" height="${FACE_SIZE}" rx="${rx}" fill="${background}"/>`
    );
  }
  for (let y = 0; y < FACE_SIZE; y++) {
    const row = face.rows[y];
    let start = -1;
    let currColor = null;
    for (let x = 0; x < FACE_SIZE; x++) {
      const c = row[x];
      const color = c !== '.' ? face.palette[c] : null;
      if (color !== currColor) {
        if (currColor && start >= 0) {
          rects.push(
            `  <rect x="${start}" y="${y}" width="${x - start}" height="1" fill="${currColor}"/>`
          );
        }
        start = x;
        currColor = color;
      }
    }
    if (currColor && start >= 0) {
      rects.push(
        `  <rect x="${start}" y="${y}" width="${FACE_SIZE - start}" height="1" fill="${currColor}"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACE_SIZE} ${FACE_SIZE}" width="${size}" height="${size}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`;
}

export function checkFacesSvg() {
  const problems = [];
  for (const [name, face] of Object.entries(FACES)) {
    const filename = `${name.toLowerCase()}.svg`;
    const targetPath = path.join(FACES_DIR, filename);
    if (!fs.existsSync(targetPath)) {
      problems.push(`missing ${filename}`);
      continue;
    }
    const expected = faceToSvg(face);
    const actual = fs.readFileSync(targetPath, 'utf8');
    if (expected !== actual) {
      problems.push(`${filename} is out of date`);
    }
  }
  return problems;
}

export function exportFaces() {
  if (!fs.existsSync(FACES_DIR)) {
    fs.mkdirSync(FACES_DIR, {recursive: true});
  }
  for (const [name, face] of Object.entries(FACES)) {
    const filename = `${name.toLowerCase()}.svg`;
    const targetPath = path.join(FACES_DIR, filename);
    fs.writeFileSync(targetPath, faceToSvg(face));
    console.log(`Exported ${filename}`);
  }
}

// CLI entry point
const isMain = process.argv[1] === __filename;
if (isMain) {
  const isCheck = process.argv.includes('--check');
  if (isCheck) {
    const problems = checkFacesSvg();
    if (problems.length) {
      console.error(
        `Face SVG check failed:\n  ${problems.join('\n  ')}\nRun \`node scripts/export-faces.js\` to update them.`
      );
      process.exit(1);
    }
    console.log('All face SVGs are up to date.');
  } else {
    exportFaces();
  }
}
