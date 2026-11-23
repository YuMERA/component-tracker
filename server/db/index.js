// *********************************************************************
// db/index.js – jedna konekcija ka SQLite bazi (node:sqlite, bez native modula)
// *********************************************************************
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { migrate } from './migrate.js';

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

migrate(db);

// Transakcija: sve ili ništa
export function tx(fn) {
    db.exec('BEGIN');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
}

export const parseJson = (s, fallback) => {
    try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};
