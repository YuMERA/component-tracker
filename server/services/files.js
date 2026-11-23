// *********************************************************************
// Lokalne kopije slika i datasheet-ova (local-first: radi i bez interneta,
// i kad proizvođač promeni ili ukloni link)
// *********************************************************************
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_PDF = 30 * 1024 * 1024;

const EXT_BY_TYPE = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'image/svg+xml': '.svg', 'application/pdf': '.pdf'
};

async function download(url, { maxBytes, accept }) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (component-tracker)', Accept: accept },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error('File too large');
    return { buf, type };
}

function save(dir, id, url, buf, ext) {
    const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
    const name = `${id}-${hash}${ext}`;
    // ukloni stare kopije iste komponente
    for (const f of fs.readdirSync(dir)) if (f.startsWith(`${id}-`) && f !== name) fs.rmSync(path.join(dir, f), { force: true });
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
}

export async function cacheImage(id) {
    const c = db.prepare('SELECT id, image_url FROM components WHERE id = ?').get(id);
    if (!c?.image_url || !/^https?:\/\//i.test(c.image_url)) return null;
    const { buf, type } = await download(c.image_url, { maxBytes: MAX_IMAGE, accept: 'image/*' });
    const ext = EXT_BY_TYPE[type] || (type.startsWith('image/') ? '.img' : null);
    if (!ext || ext === '.pdf') throw new Error(`Not an image (${type || 'unknown type'})`);
    const name = save(config.imagesDir, id, c.image_url, buf, ext);
    db.prepare('UPDATE components SET image_file = ? WHERE id = ?').run(name, id);
    return name;
}

export async function cacheDatasheet(id) {
    const c = db.prepare('SELECT id, datasheet_url FROM components WHERE id = ?').get(id);
    if (!c?.datasheet_url || !/^https?:\/\//i.test(c.datasheet_url)) throw new Error('No datasheet URL');
    const { buf, type } = await download(c.datasheet_url, { maxBytes: MAX_PDF, accept: 'application/pdf' });
    if (type !== 'application/pdf' && buf.subarray(0, 4).toString() !== '%PDF') {
        throw new Error('Link does not point directly to a PDF file');
    }
    const name = save(config.datasheetsDir, id, c.datasheet_url, buf, '.pdf');
    db.prepare('UPDATE components SET datasheet_file = ? WHERE id = ?').run(name, id);
    return name;
}

// Slike se kopiraju u pozadini posle snimanja – greška ne smeta korisniku
export function cacheImageInBackground(id) {
    cacheImage(id).catch(e => console.warn(`[files] Slika za #${id} nije preuzeta: ${e.message}`));
}

// Za Podešavanja: preuzmi sve slike koje još nemaju lokalnu kopiju
let running = null;
export function cacheAllImages() {
    if (running) return running;
    const ids = db.prepare("SELECT id FROM components WHERE image_url LIKE 'http%' AND image_file IS NULL").all().map(r => r.id);
    const result = { total: ids.length, ok: 0, failed: 0 };
    running = (async () => {
        for (const id of ids) {
            try { await cacheImage(id); result.ok++; } catch { result.failed++; }
        }
        running = null;
        return result;
    })();
    return running;
}

export function removeFiles(ids) {
    for (const dir of [config.imagesDir, config.datasheetsDir]) {
        for (const f of fs.readdirSync(dir)) {
            if (ids.some(id => f.startsWith(`${id}-`))) fs.rmSync(path.join(dir, f), { force: true });
        }
    }
}
