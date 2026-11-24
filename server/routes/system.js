// Lookup, API servisi, backup, informacije o sistemu
import { Router } from 'express';
import { db } from '../db/index.js';
import { HttpError } from '../services/components.js';
import { lookup, SUPPORTED } from '../providers/index.js';
import { cacheAllImages } from '../services/files.js';
import * as sys from '../services/system.js';

const r = Router();

// ---------------------------------------------------------------------
// Lookup – više kandidata iz svih uključenih servisa
// ---------------------------------------------------------------------
r.get('/lookup', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) throw new HttpError(400, 'Enter at least 2 characters');
    const mode = ['exact', 'begins', 'keyword'].includes(req.query.mode) ? req.query.mode : 'begins';
    res.json(await lookup(q, mode));
});

// ---------------------------------------------------------------------
// API servisi – ključ se nikad ne vraća ceo
// ---------------------------------------------------------------------
const mask = k => (k ? `${k.slice(0, 4)}…${k.slice(-3)}` : '');
const publicService = s => ({
    id: s.id, name: s.name, endpoint: s.endpoint, is_active: !!s.is_active,
    has_key: !!s.api_key, key_hint: mask(s.api_key), supported: SUPPORTED.includes(s.name),
    priority: s.priority, updated_at: s.updated_at
});

r.get('/services', (req, res) => {
    res.json(db.prepare('SELECT * FROM api_services ORDER BY priority, id').all().map(publicService));
});

r.patch('/services/:id', (req, res) => {
    const s = db.prepare('SELECT * FROM api_services WHERE id = ?').get(req.params.id);
    if (!s) throw new HttpError(404, 'Service not found');
    const key = typeof req.body.api_key === 'string' ? req.body.api_key.trim() : s.api_key;
    const active = 'is_active' in req.body ? (req.body.is_active ? 1 : 0) : s.is_active;
    db.prepare('UPDATE api_services SET api_key = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(key, key ? active : 0, s.id);
    if (key !== s.api_key) db.exec('DELETE FROM lookup_cache');
    res.json(publicService(db.prepare('SELECT * FROM api_services WHERE id = ?').get(s.id)));
});

// Glavni izvor: njegovi podaci imaju prednost pri spajanju rezultata pretrage,
// ostali servisi popunjavaju samo ono što kod njega nedostaje
r.post('/services/:id/primary', (req, res) => {
    const s = db.prepare('SELECT * FROM api_services WHERE id = ?').get(req.params.id);
    if (!s) throw new HttpError(404, 'Service not found');
    const others = db.prepare('SELECT id FROM api_services WHERE id <> ? ORDER BY priority, id').all(s.id);
    const setPriority = db.prepare('UPDATE api_services SET priority = ? WHERE id = ?');
    setPriority.run(1, s.id);
    others.forEach((o, i) => setPriority.run(i + 2, o.id));
    res.json(db.prepare('SELECT * FROM api_services ORDER BY priority, id').all().map(publicService));
});

// Test: probna pretraga samo preko jednog servisa, bez keša
r.post('/services/:id/test', async (req, res) => {
    const s = db.prepare('SELECT * FROM api_services WHERE id = ?').get(req.params.id);
    if (!s) throw new HttpError(404, 'Service not found');
    if (!s.is_active || !s.api_key) throw new HttpError(400, 'Service is disabled or has no API key');
    const result = await lookup('NE555', 'begins', { only: s.name, noCache: true });
    const src = result.sources[0];
    res.json({ ok: !!src?.ok, count: src?.count ?? 0, error: src?.error || null });
});

r.delete('/lookup-cache', (req, res) => {
    const n = db.prepare('DELETE FROM lookup_cache').run().changes;
    res.json({ removed: n });
});

// ---------------------------------------------------------------------
// Slike – preuzmi sve koje nemaju lokalnu kopiju
// ---------------------------------------------------------------------
r.post('/files/cache-images', async (req, res) => res.json(await cacheAllImages()));

// ---------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------
r.get('/backup', (req, res) => res.json(sys.backupInfo()));
r.post('/backup', (req, res) => res.status(201).json({ name: sys.createBackup(), ...sys.backupInfo() }));
r.get('/backup/:name', (req, res) => {
    const p = sys.backupPath(req.params.name);
    if (!p) throw new HttpError(404, 'Backup not found');
    res.download(p);
});
r.delete('/backup/:name', (req, res) => {
    if (!sys.deleteBackup(req.params.name)) throw new HttpError(404, 'Backup not found');
    res.status(204).end();
});

// ---------------------------------------------------------------------
// Sistem / ažuriranja
// ---------------------------------------------------------------------
r.get('/system', (req, res) => res.json(sys.systemInfo()));
r.post('/system/check-update', async (req, res) => res.json(await sys.checkForUpdates()));

export default r;
