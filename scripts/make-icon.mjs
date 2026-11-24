// *********************************************************************
// make-icon.mjs – installer/component-tracker.ico iz client/public/favicon.svg
//
//   node scripts/make-icon.mjs
//
// Isti mera znak kao u kartici pregledača. SVG iscrta Microsoft Edge (već je
// na svakom Windows-u) u svakoj veličini koju Windows traži, a PNG slike se
// spakuju u jedan .ico. Rezultat je u repou – pokreće se samo kad se znak menja.
// *********************************************************************
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const OUT = path.join(ROOT, 'installer', 'component-tracker.ico');

const edge = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
].find(p => fs.existsSync(p));
if (!edge) { console.error('Microsoft Edge nije pronađen.'); process.exit(1); }

const svg = fs.readFileSync(path.join(ROOT, 'client', 'public', 'favicon.svg'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-icon-'));
const pngs = SIZES.map(size => {
    const file = path.join(tmp, `${size}.png`);
    // tačna veličina u gornjem levom uglu: headless Edge ima minimalnu širinu prozora,
    // pa bi "100vw" centriralo znak van kadra
    const html = path.join(tmp, `icon-${size}.html`);
    fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${
        svg.replace('<svg ', `<svg width="${size}" height="${size}" style="position:fixed;left:0;top:0" `)}</body></html>`);
    execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
        `--window-size=${size},${size}`, `--screenshot=${file}`, `file:///${html.replace(/\\/g, '/')}`],
        { stdio: 'ignore', timeout: 30000 });
    return fs.readFileSync(file);
});

// ICO: zaglavlje + po jedan zapis za svaku veličinu, slike kao PNG (Windows Vista+)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(SIZES.length, 4);
const entries = [];
let offset = 6 + 16 * SIZES.length;
SIZES.forEach((size, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, ...entries, ...pngs]));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✔ ${OUT} (${SIZES.join(', ')} px)`);
