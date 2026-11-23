// *********************************************************************
// Lokacije – hijerarhija, pune putanje ("Ormar A › Fioka 3")
// *********************************************************************
import { db } from '../db/index.js';

export const SEP = ' › ';

export function allLocations() {
    const rows = db.prepare(`
        SELECT l.*,
               (SELECT COUNT(DISTINCT s.component_id) FROM stock s WHERE s.location_id = l.id) AS component_count,
               (SELECT IFNULL(SUM(s.quantity), 0) FROM stock s WHERE s.location_id = l.id) AS total_quantity
        FROM locations l`).all();
    const byId = new Map(rows.map(r => [r.id, r]));
    const pathOf = r => {
        const parts = [];
        const seen = new Set();
        for (let cur = r; cur && !seen.has(cur.id); cur = byId.get(cur.parent_id)) {
            seen.add(cur.id);
            parts.unshift(cur.name);
        }
        return parts;
    };
    return rows
        .map(r => {
            const parts = pathOf(r);
            return { ...r, path: parts.join(SEP), depth: parts.length - 1 };
        })
        .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
}

// Sva deca (rekurzivno) – za filter "lokacija sa podlokacijama" i zaštitu od ciklusa
export function descendantIds(id) {
    return db.prepare(`
        WITH RECURSIVE tree(id) AS (
            SELECT id FROM locations WHERE id = ?
            UNION ALL
            SELECT l.id FROM locations l JOIN tree t ON l.parent_id = t.id
        ) SELECT id FROM tree`).all(id).map(r => r.id);
}

// Pronađi ili napravi lokaciju po nazivu (unos "Ormar A › Fioka 3" pravi celu putanju)
export function ensureLocationPath(text) {
    const parts = String(text).split(/\s*[›>\/]\s*/).map(s => s.trim()).filter(Boolean);
    let parentId = null;
    for (const name of parts) {
        const found = db.prepare('SELECT id FROM locations WHERE IFNULL(parent_id, 0) = ? AND name = ? COLLATE NOCASE')
            .get(parentId ?? 0, name);
        parentId = found ? found.id
            : Number(db.prepare('INSERT INTO locations (name, parent_id) VALUES (?, ?)').run(name, parentId).lastInsertRowid);
    }
    return parentId;
}
