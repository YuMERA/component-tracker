// Kategorije i lokacije
import { Router } from 'express';
import { db } from '../db/index.js';
import { HttpError } from '../services/components.js';
import { trashCategory, trashLocation } from '../services/trash.js';
import { allLocations, descendantIds, ensureLocationPath } from '../services/locations.js';

const r = Router();
const clean = v => (typeof v === 'string' ? v.trim() || null : v ?? null);

function uniqueError(e, message) {
    if (String(e.message).includes('UNIQUE')) throw new HttpError(409, message);
    throw e;
}

// ---------------------------------------------------------------------
// Kategorije
// ---------------------------------------------------------------------
r.get('/categories', (req, res) => {
    res.json(db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM components x WHERE x.category_id = c.id) AS component_count
        FROM categories c ORDER BY c.name COLLATE NOCASE`).all());
});

r.post('/categories', (req, res) => {
    const name = clean(req.body.name);
    if (!name) throw new HttpError(400, 'Name is required');
    const existing = db.prepare('SELECT * FROM categories WHERE name = ? COLLATE NOCASE').get(name);
    if (existing) return res.json(existing);
    const id = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(name, req.body.parent_id || null).lastInsertRowid;
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

r.patch('/categories/:id', (req, res) => {
    const name = clean(req.body.name);
    if (!name) throw new HttpError(400, 'Name is required');
    try {
        db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, req.params.id);
    } catch (e) { uniqueError(e, 'Category with this name already exists'); }
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// Brisanje (u kantu): komponente prelaze u drugu kategoriju (ili ostaju bez kategorije)
r.delete('/categories/:id', (req, res) => {
    const target = req.query.move_to ? Number(req.query.move_to) : null;
    res.json({ trash: [trashCategory(Number(req.params.id), target)] });
});

// ---------------------------------------------------------------------
// Lokacije
// ---------------------------------------------------------------------
r.get('/locations', (req, res) => res.json(allLocations()));

// Putanja "Ormar A › Fioka 3" → id (pravi lokacije koje ne postoje)
r.post('/locations/ensure', (req, res) => {
    const text = clean(req.body.path);
    if (!text) throw new HttpError(400, 'Path is required');
    const id = ensureLocationPath(text);
    res.json(allLocations().find(l => l.id === id));
});

r.post('/locations', (req, res) => {
    const name = clean(req.body.name);
    if (!name) throw new HttpError(400, 'Name is required');
    try {
        const id = db.prepare('INSERT INTO locations (name, parent_id, description) VALUES (?, ?, ?)')
            .run(name, req.body.parent_id || null, clean(req.body.description)).lastInsertRowid;
        res.status(201).json(allLocations().find(l => l.id === Number(id)));
    } catch (e) { uniqueError(e, 'Location with this name already exists here'); }
});

r.patch('/locations/:id', (req, res) => {
    const id = Number(req.params.id);
    const name = clean(req.body.name);
    const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;
    if (!name) throw new HttpError(400, 'Name is required');
    if (parentId && descendantIds(id).includes(parentId)) {
        throw new HttpError(400, 'A location cannot be placed inside itself');
    }
    try {
        db.prepare('UPDATE locations SET name = ?, parent_id = ?, description = ? WHERE id = ?')
            .run(name, parentId, clean(req.body.description), id);
    } catch (e) { uniqueError(e, 'Location with this name already exists here'); }
    res.json(allLocations().find(l => l.id === id));
});

// Brisanje (u kantu): podlokacije i stanje prelaze na roditelja (ništa se ne gubi)
r.delete('/locations/:id', (req, res) => {
    res.json({ trash: [trashLocation(Number(req.params.id))] });
});

export default r;
