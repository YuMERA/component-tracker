// *********************************************************************
// Kanta: sve što se obriše u aplikaciji (komponente, lokacije, kategorije)
// čuva se kao snimak dok korisnik ne isprazni kantu.
//
// - Komponenta: ceo red, stanje po lokacijama, istorija promena; slika i datasheet
//   se premeštaju u data/trash/ (ne brišu se).
// - Lokacija: brisanje prebacuje podlokacije i komade na nadređenu – snimak pamti
//   šta je prebačeno, da bi vraćanje moglo da ih vrati nazad.
// - Kategorija: brisanje prebacuje komponente u drugu kategoriju (ili bez kategorije) –
//   snimak pamti koje su to komponente.
//
// Vraćanje koristi isti id kao pre brisanja (AUTOINCREMENT nikad ne daje stari id
// novom zapisu), pa se veze sa drugim podacima same uspostave.
// *********************************************************************
import fs from 'node:fs';
import path from 'node:path';
import { db, tx, parseJson } from '../db/index.js';
import { config } from '../config.js';
import { HttpError, findByMpn } from './components.js';
import { allLocations } from './locations.js';

const FILE_DIRS = [[config.imagesDir, config.trashImagesDir], [config.datasheetsDir, config.trashDatasheetsDir]];

function addToTrash(kind, label, detail, payload) {
    return Number(db.prepare('INSERT INTO trash (kind, label, detail, payload) VALUES (?, ?, ?, ?)')
        .run(kind, label, JSON.stringify(detail), JSON.stringify(payload)).lastInsertRowid);
}

// Fajlovi komponente su "<id>-<hash>.<ext>" – premesti ih između aktivnog foldera i kante
function moveFiles(componentId, toTrash) {
    for (const [live, trash] of FILE_DIRS) {
        const [from, to] = toTrash ? [live, trash] : [trash, live];
        for (const f of fs.readdirSync(from)) {
            if (f.startsWith(`${componentId}-`)) fs.renameSync(path.join(from, f), path.join(to, f));
        }
    }
}

function removeTrashFiles(componentId = null) {
    for (const [, trash] of FILE_DIRS) {
        for (const f of fs.readdirSync(trash)) {
            if (componentId == null || f.startsWith(`${componentId}-`)) fs.rmSync(path.join(trash, f), { force: true });
        }
    }
}

// Zapis u istoriju komponente (delta 0 = događaj bez promene količine, npr. kanta)
function logHistory(componentId, locationId, delta, quantityAfter, kind, note = null, createdAt = null) {
    db.prepare(`INSERT INTO stock_movements (component_id, location_id, delta, quantity_after, kind, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, IFNULL(?, CURRENT_TIMESTAMP))`)
        .run(componentId, locationId ?? null, delta, quantityAfter, kind, note, createdAt);
}
const qtyAt = (componentId, locationId) =>
    db.prepare('SELECT quantity FROM stock WHERE component_id = ? AND IFNULL(location_id, 0) = ?').get(componentId, locationId ?? 0)?.quantity ?? 0;

const exists = (table, id) => id != null && !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);
const insertRow = (table, row) => {
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map(c => row[c]));
};

// ---------------------------------------------------------------------
// Brisanje (u kantu)
// ---------------------------------------------------------------------
export function trashComponents(ids) {
    const trashIds = [];
    tx(() => {
        for (const id of ids.map(Number)) {
            const row = db.prepare('SELECT * FROM components WHERE id = ?').get(id);
            if (!row) continue;
            const stock = db.prepare('SELECT * FROM stock WHERE component_id = ?').all(id);
            const movements = db.prepare('SELECT * FROM stock_movements WHERE component_id = ?').all(id);
            const quantity = stock.reduce((s, r) => s + r.quantity, 0);
            trashIds.push(addToTrash('component', row.name, { mpn: row.mpn, quantity }, { row, stock, movements }));
            db.prepare('DELETE FROM components WHERE id = ?').run(id);
        }
    });
    // fajlovi tek posle uspešnog upisa u bazu
    for (const id of ids) moveFiles(Number(id), true);
    return trashIds;
}

// Komponente prelaze u drugu kategoriju (moveTo) ili ostaju bez kategorije
export function trashCategory(id, moveTo = null) {
    return tx(() => {
        const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!row) throw new HttpError(404, 'Category not found');
        const components = db.prepare('SELECT id FROM components WHERE category_id = ?').all(id).map(r => r.id);
        db.prepare('UPDATE components SET category_id = ? WHERE category_id = ?').run(moveTo, id);
        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        return addToTrash('category', row.name, { components: components.length }, { row, components, moveTo });
    });
}

// Podlokacije i stanje prelaze na nadređenu lokaciju (ništa se ne gubi)
export function trashLocation(id) {
    return tx(() => {
        const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
        if (!loc) throw new HttpError(404, 'Location not found');
        const label = allLocations().find(l => l.id === id)?.path || loc.name;
        const children = db.prepare('SELECT id FROM locations WHERE parent_id = ?').all(id).map(r => r.id);
        // zapisi istorije sa ove lokacije (brisanje im briše lokaciju – vraćanje je vraća)
        const history = db.prepare('SELECT id FROM stock_movements WHERE location_id = ?').all(id).map(r => r.id);
        db.prepare('UPDATE locations SET parent_id = ? WHERE parent_id = ?').run(loc.parent_id, id);
        const moved = [];
        for (const s of db.prepare('SELECT * FROM stock WHERE location_id = ?').all(id)) {
            moved.push({ component_id: s.component_id, quantity: s.quantity });
            const dst = db.prepare('SELECT * FROM stock WHERE component_id = ? AND IFNULL(location_id, 0) = ?').get(s.component_id, loc.parent_id ?? 0);
            if (dst) {
                db.prepare('UPDATE stock SET quantity = quantity + ? WHERE id = ?').run(s.quantity, dst.id);
                db.prepare('DELETE FROM stock WHERE id = ?').run(s.id);
            } else {
                db.prepare('UPDATE stock SET location_id = ? WHERE id = ?').run(loc.parent_id, s.id);
            }
            logHistory(s.component_id, loc.parent_id, s.quantity, qtyAt(s.component_id, loc.parent_id), 'location_deleted', label);
        }
        db.prepare('DELETE FROM locations WHERE id = ?').run(id);
        const pieces = moved.reduce((s, m) => s + m.quantity, 0);
        return addToTrash('location', label, { children: children.length, pieces }, { row: loc, children, moved, history });
    });
}

// ---------------------------------------------------------------------
// Vraćanje
// ---------------------------------------------------------------------
function restoreComponent({ row, stock, movements }, force, deletedAt) {
    if (exists('components', row.id)) throw new HttpError(409, 'Component already exists');
    const dup = findByMpn(row.mpn);
    if (dup && !force) throw new HttpError(409, 'Component with this MPN already exists', { existing: dup });
    const notes = [];
    if (row.category_id && !exists('categories', row.category_id)) { row = { ...row, category_id: null }; notes.push('category'); }
    insertRow('components', row);
    // komadi sa obrisane lokacije idu na "bez lokacije"
    const byLoc = new Map();
    for (const s of stock) {
        const loc = exists('locations', s.location_id) ? s.location_id : null;
        if (s.location_id && loc == null) notes.push('location');
        byLoc.set(loc ?? 0, { loc, qty: (byLoc.get(loc ?? 0)?.qty ?? 0) + s.quantity });
    }
    for (const { loc, qty } of byLoc.values()) {
        db.prepare('INSERT INTO stock (component_id, location_id, quantity) VALUES (?, ?, ?)').run(row.id, loc, qty);
    }
    for (const m of movements) insertRow('stock_movements', { ...m, location_id: exists('locations', m.location_id) ? m.location_id : null });
    // u istoriji: kad je obrisana i kad je vraćena
    const total = stock.reduce((sum, x) => sum + x.quantity, 0);
    logHistory(row.id, null, 0, total, 'trashed', null, deletedAt);
    logHistory(row.id, null, 0, total, 'restored');
    return { id: row.id, notes: [...new Set(notes)] };
}

function restoreCategory({ row, components, moveTo }) {
    // ako je u međuvremenu napravljena kategorija istog naziva, komponente idu u nju
    const same = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(row.name);
    const id = same ? same.id : (insertRow('categories', row), row.id);
    const placeholders = components.map(() => '?').join(',');
    if (components.length) {
        // samo one kojima kategorija nije menjana posle brisanja
        db.prepare(`UPDATE components SET category_id = ? WHERE id IN (${placeholders}) AND IFNULL(category_id, 0) = ?`)
            .run(id, ...components, moveTo ?? 0);
    }
    return { id, notes: same ? ['merged'] : [] };
}

function restoreLocation({ row, children, moved, history = [] }) {
    if (exists('locations', row.id)) throw new HttpError(409, 'Location already exists');
    const parent = exists('locations', row.parent_id) ? row.parent_id : null;
    // naziv zauzet na istom mestu → "Kutija 1 (2)"
    let name = row.name;
    for (let n = 2; db.prepare('SELECT 1 FROM locations WHERE IFNULL(parent_id, 0) = ? AND name = ? COLLATE NOCASE').get(parent ?? 0, name); n++) {
        name = `${row.name} (${n})`;
    }
    insertRow('locations', { ...row, name, parent_id: parent });
    for (const hid of history) db.prepare('UPDATE stock_movements SET location_id = ? WHERE id = ? AND location_id IS NULL').run(row.id, hid);
    // podlokacije koje su i dalje tamo gde ih je brisanje prebacilo
    for (const cid of children) {
        db.prepare('UPDATE locations SET parent_id = ? WHERE id = ? AND IFNULL(parent_id, 0) = ?').run(row.id, cid, row.parent_id ?? 0);
    }
    // komadi: vrati sa nadređene onoliko koliko je prebačeno (ako ih je u međuvremenu manje, koliko ima)
    for (const m of moved) {
        const src = db.prepare('SELECT * FROM stock WHERE component_id = ? AND IFNULL(location_id, 0) = ?').get(m.component_id, row.parent_id ?? 0);
        const qty = Math.min(m.quantity, src?.quantity ?? 0);
        if (!qty) continue;
        if (src.quantity === qty) db.prepare('DELETE FROM stock WHERE id = ?').run(src.id);
        else db.prepare('UPDATE stock SET quantity = quantity - ? WHERE id = ?').run(qty, src.id);
        db.prepare('INSERT INTO stock (component_id, location_id, quantity) VALUES (?, ?, ?)').run(m.component_id, row.id, qty);
        const path = allLocations().find(l => l.id === row.id)?.path || name;
        logHistory(m.component_id, row.parent_id, -qty, qtyAt(m.component_id, row.parent_id), 'location_restored', path);
        logHistory(m.component_id, row.id, qty, qty, 'location_restored', path);
    }
    return { id: row.id, notes: name !== row.name ? ['renamed'] : [] };
}

const RESTORE = { component: restoreComponent, category: restoreCategory, location: restoreLocation };

export function restore(trashId, { force = false } = {}) {
    const item = db.prepare('SELECT * FROM trash WHERE id = ?').get(trashId);
    if (!item) throw new HttpError(404, 'Not in trash');
    const result = tx(() => {
        const r = RESTORE[item.kind](JSON.parse(item.payload), force, item.deleted_at);
        db.prepare('DELETE FROM trash WHERE id = ?').run(item.id);
        return r;
    });
    if (item.kind === 'component') moveFiles(result.id, false);
    return { kind: item.kind, label: item.label, ...result };
}

// Redom od poslednjeg obrisanog (kao "poništi" više puta) – tako se prvo vrati
// lokacija, pa komponenta koja je bila u njoj
export function restoreMany(ids = null, { force = false } = {}) {
    const items = db.prepare('SELECT id, label FROM trash ORDER BY deleted_at DESC, id DESC').all()
        .filter(i => !ids || ids.includes(i.id));
    const restored = [], skipped = [];
    for (const i of items) {
        try { restored.push(restore(i.id, { force })); }
        catch (e) { if (e.status === 409) skipped.push(i.label); else throw e; }
    }
    return { restored: restored.length, skipped };
}

// ---------------------------------------------------------------------
// Pregled i trajno brisanje
// ---------------------------------------------------------------------
export function listTrash() {
    return db.prepare('SELECT id, kind, label, detail, deleted_at FROM trash ORDER BY deleted_at DESC, id DESC').all()
        .map(t => ({ ...t, detail: parseJson(t.detail, {}) }));
}

export const trashCount = () => db.prepare('SELECT COUNT(*) AS n FROM trash').get().n;

export function purge(trashId) {
    const item = db.prepare('SELECT * FROM trash WHERE id = ?').get(trashId);
    if (!item) throw new HttpError(404, 'Not in trash');
    db.prepare('DELETE FROM trash WHERE id = ?').run(item.id);
    if (item.kind === 'component') removeTrashFiles(JSON.parse(item.payload).row.id);
}

export function emptyTrash() {
    const n = db.prepare('DELETE FROM trash').run().changes;
    removeTrashFiles();
    return n;
}
