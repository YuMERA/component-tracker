// *********************************************************************
// Komponente i stanje – sva poslovna logika na jednom mestu
// Rute samo pozivaju ove funkcije.
// *********************************************************************
import { db, tx, parseJson } from '../db/index.js';
import { allLocations, ensureLocationPath } from './locations.js';

export class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

const FIELDS = ['name', 'mpn', 'manufacturer', 'package', 'category_id', 'description', 'notes',
    'params', 'min_stock', 'image_url', 'datasheet_url'];

const clean = v => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() || null : v ?? null);

function pickFields(body) {
    const out = {};
    for (const key of FIELDS) {
        if (!(key in body)) continue;
        let v = body[key];
        if (key === 'params') v = Array.isArray(v) && v.length ? JSON.stringify(v) : null;
        else if (key === 'min_stock') v = Math.max(0, parseInt(v, 10) || 0);
        else if (key === 'category_id') v = v ? Number(v) : null;
        else v = clean(v);
        out[key] = v;
    }
    return out;
}

// ---------------------------------------------------------------------
// Čitanje
// ---------------------------------------------------------------------
function stockByComponent() {
    const paths = new Map(allLocations().map(l => [l.id, l.path]));
    const map = new Map();
    for (const s of db.prepare('SELECT * FROM stock ORDER BY id').all()) {
        if (!map.has(s.component_id)) map.set(s.component_id, []);
        map.get(s.component_id).push({
            id: s.id,
            location_id: s.location_id,
            location: s.location_id ? paths.get(s.location_id) : null,
            quantity: s.quantity
        });
    }
    return map;
}

function shape(c, stock) {
    const rows = stock || [];
    return {
        ...c,
        params: parseJson(c.params, []),
        stock: rows,
        quantity: rows.reduce((sum, s) => sum + s.quantity, 0)
    };
}

export function listComponents() {
    const stock = stockByComponent();
    return db.prepare(`
        SELECT c.*, cat.name AS category
        FROM components c LEFT JOIN categories cat ON cat.id = c.category_id
        ORDER BY c.name COLLATE NOCASE`).all()
        .map(c => shape(c, stock.get(c.id)));
}

export function getComponent(id) {
    const c = db.prepare(`
        SELECT c.*, cat.name AS category
        FROM components c LEFT JOIN categories cat ON cat.id = c.category_id
        WHERE c.id = ?`).get(id);
    if (!c) throw new HttpError(404, 'Component not found');
    return shape(c, stockByComponent().get(c.id));
}

export function getMovements({ componentId = null, limit = 50 } = {}) {
    const paths = new Map(allLocations().map(l => [l.id, l.path]));
    const rows = db.prepare(`
        SELECT m.*, c.name AS component_name, c.mpn
        FROM stock_movements m JOIN components c ON c.id = m.component_id
        WHERE (? IS NULL OR m.component_id = ?)
        ORDER BY m.id DESC LIMIT ?`).all(componentId, componentId, limit);
    return rows.map(m => ({ ...m, location: m.location_id ? paths.get(m.location_id) : null }));
}

export function findByMpn(mpn, exceptId = null) {
    if (!mpn) return null;
    return db.prepare('SELECT id, name, mpn FROM components WHERE mpn = ? COLLATE NOCASE AND id IS NOT ?').get(mpn, exceptId);
}

// ---------------------------------------------------------------------
// Stanje
// ---------------------------------------------------------------------
function logMovement(componentId, locationId, delta, quantityAfter, kind, note = null) {
    if (!delta) return;
    db.prepare('INSERT INTO stock_movements (component_id, location_id, delta, quantity_after, kind, note) VALUES (?, ?, ?, ?, ?, ?)')
        .run(componentId, locationId ?? null, delta, quantityAfter, kind, clean(note));
}

const findStock = (componentId, locationId) =>
    db.prepare('SELECT * FROM stock WHERE component_id = ? AND IFNULL(location_id, 0) = ?').get(componentId, locationId ?? 0);

// Postavi tačnu količinu na lokaciji (pravi red ako ne postoji)
function setStock(componentId, locationId, quantity, kind, note) {
    quantity = Math.max(0, parseInt(quantity, 10) || 0);
    const row = findStock(componentId, locationId);
    if (row) {
        db.prepare('UPDATE stock SET quantity = ? WHERE id = ?').run(quantity, row.id);
        logMovement(componentId, locationId, quantity - row.quantity, quantity, kind, note);
    } else {
        db.prepare('INSERT INTO stock (component_id, location_id, quantity) VALUES (?, ?, ?)').run(componentId, locationId ?? null, quantity);
        logMovement(componentId, locationId, quantity, quantity, kind, note);
    }
}

function touch(componentId) {
    db.prepare('UPDATE components SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(componentId);
}

/**
 * Usklađuje stanje komponente sa listom iz forme:
 * [{ location_id, quantity }] – redovi koji nisu u listi se uklanjaju (uz zapis u dnevnik).
 */
function syncStock(componentId, rows, kind) {
    const wanted = new Map();
    for (const r of rows || []) {
        const loc = r.location_id ? Number(r.location_id) : null;
        wanted.set(loc ?? 0, { loc, qty: Math.max(0, parseInt(r.quantity, 10) || 0) });
    }
    for (const existing of db.prepare('SELECT * FROM stock WHERE component_id = ?').all(componentId)) {
        if (!wanted.has(existing.location_id ?? 0)) {
            db.prepare('DELETE FROM stock WHERE id = ?').run(existing.id);
            logMovement(componentId, existing.location_id, -existing.quantity, 0, kind);
        }
    }
    for (const { loc, qty } of wanted.values()) setStock(componentId, loc, qty, kind);
}

export function adjustStock(componentId, { location_id = null, delta = 0, note }) {
    getComponent(componentId);
    tx(() => {
        const row = findStock(componentId, location_id);
        const current = row?.quantity ?? 0;
        setStock(componentId, location_id, Math.max(0, current + (parseInt(delta, 10) || 0)), 'adjust', note);
        touch(componentId);
    });
    return getComponent(componentId);
}

export function moveStock(componentId, { from = null, to = null, quantity }) {
    const qty = parseInt(quantity, 10) || 0;
    if (qty <= 0) throw new HttpError(400, 'Quantity must be positive');
    if ((from ?? 0) === (to ?? 0)) throw new HttpError(400, 'Source and target are the same');
    tx(() => {
        const src = findStock(componentId, from);
        if (!src || src.quantity < qty) throw new HttpError(400, 'Not enough stock at source location');
        setStock(componentId, from, src.quantity - qty, 'move');
        if (src.quantity - qty === 0) db.prepare('DELETE FROM stock WHERE id = ?').run(src.id);
        const dst = findStock(componentId, to);
        setStock(componentId, to, (dst?.quantity ?? 0) + qty, 'move');
        touch(componentId);
    });
    return getComponent(componentId);
}

// ---------------------------------------------------------------------
// Upis
// ---------------------------------------------------------------------
export function createComponent(body) {
    const data = pickFields(body);
    if (!data.name) throw new HttpError(400, 'Name is required');
    if (!body.force) {
        const dup = findByMpn(data.mpn);
        if (dup) throw new HttpError(409, 'Component with this MPN already exists', { existing: getComponent(dup.id) });
    }
    const id = tx(() => {
        const cols = Object.keys(data);
        const r = db.prepare(`INSERT INTO components (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
            .run(...cols.map(c => data[c]));
        const newId = Number(r.lastInsertRowid);
        syncStock(newId, body.stock?.length ? body.stock : [{ location_id: null, quantity: 0 }], 'initial');
        return newId;
    });
    return getComponent(id);
}

export function updateComponent(id, body) {
    const before = getComponent(id);
    const data = pickFields(body);
    if ('name' in data && !data.name) throw new HttpError(400, 'Name is required');
    tx(() => {
        const cols = Object.keys(data);
        if (cols.length) {
            db.prepare(`UPDATE components SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                .run(...cols.map(c => data[c]), before.id);
        }
        // URL slike/datasheet-a se promenio → lokalna kopija više ne važi
        if ('image_url' in data && data.image_url !== before.image_url) {
            db.prepare('UPDATE components SET image_file = NULL WHERE id = ?').run(before.id);
        }
        if ('datasheet_url' in data && data.datasheet_url !== before.datasheet_url) {
            db.prepare('UPDATE components SET datasheet_file = NULL WHERE id = ?').run(before.id);
        }
        if (Array.isArray(body.stock)) syncStock(before.id, body.stock, 'manual');
    });
    return getComponent(before.id);
}

export function bulkUpdate(ids, action, value) {
    if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'No components selected');
    ids = ids.map(Number);
    const placeholders = ids.map(() => '?').join(',');

    if (action === 'category') {
        return db.prepare(`UPDATE components SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`)
            .run(value ? Number(value) : null, ...ids).changes;
    }

    if (action === 'location') {
        // Celokupno stanje izabranih komponenti se premešta na jednu lokaciju
        const target = value ? Number(value) : null;
        return tx(() => {
            for (const id of ids) {
                const rows = db.prepare('SELECT * FROM stock WHERE component_id = ?').all(id);
                const total = rows.reduce((s, r) => s + r.quantity, 0);
                for (const r of rows) if ((r.location_id ?? 0) !== (target ?? 0)) {
                    db.prepare('DELETE FROM stock WHERE id = ?').run(r.id);
                    logMovement(id, r.location_id, -r.quantity, 0, 'move');
                }
                setStock(id, target, total, 'move');
                touch(id);
            }
            return ids.length;
        });
    }
    throw new HttpError(400, 'Unknown action');
}

// ---------------------------------------------------------------------
// Uvoz liste (CSV iz Excel-a ili izvoz iz ove aplikacije)
// rows: [{ name, mpn, manufacturer, package, category, location, quantity, min_stock, description, datasheet_url }]
//   location može biti i "Kutija 1: 5; Kutija 2: 3" (format izvoza) – tada se quantity ne koristi
// existing: 'skip' – postojeće komponente se preskaču, 'add' – dodaje im se količina
// dryRun: samo vrati šta bi se desilo (pregled pre uvoza), ništa ne upisuje
// Postojeća = isti MPN, a za redove bez MPN-a isti naziv.
// ---------------------------------------------------------------------
const STOCK_LIST = /^\s*(?:[^:;]*:\s*\d+\s*(?:;|$)\s*)+$/;

function importStock(r) {
    const loc = clean(r.location != null ? String(r.location) : null);
    if (loc && STOCK_LIST.test(loc)) {
        return loc.split(';').map(s => s.trim()).filter(Boolean).map(s => {
            const i = s.lastIndexOf(':');
            const path = s.slice(0, i).trim();
            return { path: path && path !== '-' ? path : null, quantity: parseInt(s.slice(i + 1), 10) || 0 };
        });
    }
    const qty = Math.max(0, parseInt(String(r.quantity ?? '').replace(/[^\d-]/g, ''), 10) || 0);
    return [{ path: loc, quantity: qty }];
}

export function importComponents({ rows, existing = 'skip', dryRun = false }) {
    if (!Array.isArray(rows)) throw new HttpError(400, 'No rows');
    const findByName = name => db.prepare('SELECT id, name, mpn FROM components WHERE name = ? COLLATE NOCASE ORDER BY id LIMIT 1').get(name);
    const seen = new Map();                 // za pregled: isti deo dva puta u istom fajlu
    const result = [];

    const run = () => {
        for (const [i, r] of rows.entries()) {
            const mpn = clean(r.mpn != null ? String(r.mpn) : null);
            const name = clean(r.name != null ? String(r.name) : null) || mpn;   // bez naziva → MPN (kao Mouser korpa)
            if (!name) { result.push({ row: i, action: 'error', error: 'name' }); continue; }
            const key = (mpn || `#${name}`).toUpperCase();
            const stock = importStock(r);
            const qty = stock.reduce((s, x) => s + x.quantity, 0);
            const found = (mpn ? findByMpn(mpn) : findByName(name)) || seen.get(key);

            if (found) {
                if (existing !== 'add' || !qty) { result.push({ row: i, action: 'skip', name, existing_id: found.id }); continue; }
                if (!dryRun) {
                    for (const s of stock) {
                        if (!s.quantity) continue;
                        const locId = s.path ? ensureLocationPath(s.path) : null;
                        const cur = findStock(found.id, locId)?.quantity ?? 0;
                        setStock(found.id, locId, cur + s.quantity, 'import');
                    }
                    touch(found.id);
                }
                result.push({ row: i, action: 'add', name, quantity: qty, existing_id: found.id });
                continue;
            }

            if (!dryRun) {
                let category_id = null;
                const cat = clean(r.category != null ? String(r.category) : null);
                if (cat) {
                    category_id = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(cat)?.id
                        ?? Number(db.prepare('INSERT INTO categories (name) VALUES (?)').run(cat).lastInsertRowid);
                }
                const data = pickFields({
                    name, mpn, manufacturer: r.manufacturer, package: r.package, category_id,
                    min_stock: r.min_stock, description: r.description, datasheet_url: r.datasheet_url
                });
                const cols = Object.keys(data);
                const id = Number(db.prepare(`INSERT INTO components (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
                    .run(...cols.map(c => data[c])).lastInsertRowid);
                const merged = new Map();
                for (const s of stock) {
                    const locId = s.path ? ensureLocationPath(s.path) : null;
                    merged.set(locId ?? 0, { location_id: locId, quantity: (merged.get(locId ?? 0)?.quantity ?? 0) + s.quantity });
                }
                syncStock(id, [...merged.values()], 'import');
                seen.set(key, { id });
            } else {
                seen.set(key, { id: null });
            }
            result.push({ row: i, action: 'new', name, quantity: qty });
        }
    };
    dryRun ? run() : tx(run);

    const count = a => result.filter(x => x.action === a).length;
    return { rows: result, summary: { new: count('new'), add: count('add'), skip: count('skip'), error: count('error') } };
}
