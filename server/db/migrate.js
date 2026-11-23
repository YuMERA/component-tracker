// *********************************************************************
// migrate.js – verzionisane migracije (PRAGMA user_version)
// Svaka migracija se izvršava tačno jednom, u transakciji.
// *********************************************************************

const SCHEMA_V1 = `
    CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX ux_categories_name ON categories(name COLLATE NOCASE);

    -- Hijerarhija lokacija: Ormar A → Fioka 3 → Kutija 2
    CREATE TABLE locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX ux_locations_name ON locations(IFNULL(parent_id, 0), name COLLATE NOCASE);

    CREATE TABLE components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mpn TEXT,
        manufacturer TEXT,
        package TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        notes TEXT,
        params TEXT,                -- JSON [{name, value}]
        min_stock INTEGER NOT NULL DEFAULT 0,
        image_url TEXT,
        image_file TEXT,            -- lokalna kopija slike (data/images)
        datasheet_url TEXT,
        datasheet_file TEXT,        -- lokalna kopija datasheet-a (data/datasheets)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX ix_components_mpn ON components(mpn COLLATE NOCASE);
    CREATE INDEX ix_components_category ON components(category_id);

    -- Količina po komponenti I lokaciji (ista komponenta može biti na više mesta)
    CREATE TABLE stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0)
    );
    CREATE UNIQUE INDEX ux_stock ON stock(component_id, IFNULL(location_id, 0));

    -- Dnevnik svih promena stanja
    CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
        delta INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'manual',   -- initial | manual | adjust | move | migrated
        note TEXT,                             -- slobodan tekst korisnika
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX ix_movements_component ON stock_movements(component_id, id);

    CREATE TABLE lookup_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
`;

const API_SERVICES = `
    CREATE TABLE IF NOT EXISTS api_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        api_key TEXT NOT NULL,
        additional_params TEXT,
        is_active INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`;

const tableExists = (db, name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

const MIGRATIONS = [
    // 1: nova šema + prenos podataka iz v2 (ravna tabela components)
    db => {
        const legacy = tableExists(db, 'components');
        if (legacy) {
            db.exec('ALTER TABLE components RENAME TO legacy_components');
            if (tableExists(db, 'categories')) db.exec('ALTER TABLE categories RENAME TO legacy_categories');
        }

        db.exec(SCHEMA_V1);
        db.exec(API_SERVICES);

        // Podrazumevani servisi (bez ključa) da se odmah vide u Podešavanjima
        const hasService = db.prepare('SELECT 1 FROM api_services WHERE name = ?');
        const addService = db.prepare('INSERT INTO api_services (name, endpoint, api_key, is_active) VALUES (?, ?, ?, 0)');
        if (!hasService.get('element14')) addService.run('element14', 'api.element14.com', '');
        if (!hasService.get('mouser')) addService.run('mouser', 'api.mouser.com', '');
        // v3: is_active znači "uključen" i više servisa može raditi istovremeno
        db.exec("UPDATE api_services SET is_active = 1 WHERE api_key <> ''");

        if (!legacy) return;

        // --- Kategorije ---
        const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
        const names = new Set();
        if (tableExists(db, 'legacy_categories')) {
            for (const r of db.prepare('SELECT name FROM legacy_categories').all()) names.add(r.name.trim());
        }
        for (const r of db.prepare('SELECT DISTINCT category FROM legacy_components WHERE category IS NOT NULL').all()) {
            if (r.category.trim()) names.add(r.category.trim());
        }
        for (const n of names) insertCategory.run(n);
        const categoryId = new Map(db.prepare('SELECT id, name FROM categories').all().map(r => [r.name.toLowerCase(), r.id]));

        // --- Lokacije (iz slobodnog teksta) ---
        const insertLocation = db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)');
        for (const r of db.prepare('SELECT DISTINCT TRIM(location) AS location FROM legacy_components WHERE TRIM(IFNULL(location, \'\')) <> \'\'').all()) {
            insertLocation.run(r.location);
        }
        const locationId = new Map(db.prepare('SELECT id, name FROM locations').all().map(r => [r.name.toLowerCase(), r.id]));

        // --- Komponente + stanje ---
        const insertComponent = db.prepare(`
            INSERT INTO components (id, name, mpn, manufacturer, package, category_id, description, params,
                                    min_stock, image_url, datasheet_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insertStock = db.prepare('INSERT INTO stock (component_id, location_id, quantity) VALUES (?, ?, ?)');
        const insertMove = db.prepare('INSERT INTO stock_movements (component_id, location_id, delta, quantity_after, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)');

        const clean = s => (typeof s === 'string' ? s.replace(/\r\n/g, '\n').trim() || null : s ?? null);

        for (const c of db.prepare('SELECT * FROM legacy_components').all()) {
            const locId = c.location?.trim() ? locationId.get(c.location.trim().toLowerCase()) : null;
            insertComponent.run(
                c.id, c.name.trim(), clean(c.part_number),
                null, null,   // manufacturer, package – v2 ih nije imala
                c.category ? categoryId.get(c.category.trim().toLowerCase()) ?? null : null,
                clean(c.description),
                null,   // params
                c.min_stock || 0, clean(c.image_url), clean(c.datasheet_url),
                c.created_at, c.created_at
            );
            insertStock.run(c.id, locId ?? null, Math.max(0, c.quantity || 0));
            insertMove.run(c.id, locId ?? null, c.quantity || 0, Math.max(0, c.quantity || 0), 'migrated', c.created_at);
        }

        db.exec('DROP TABLE legacy_components; DROP TABLE IF EXISTS legacy_categories;');
    }
];

export function migrate(db) {
    const current = db.prepare('PRAGMA user_version').get().user_version;
    for (let v = current; v < MIGRATIONS.length; v++) {
        db.exec('PRAGMA foreign_keys = OFF; BEGIN');
        try {
            MIGRATIONS[v](db);
            db.exec(`PRAGMA user_version = ${v + 1}`);
            db.exec('COMMIT; PRAGMA foreign_keys = ON;');
            console.log(`[db] Migracija ${v + 1} završena`);
        } catch (e) {
            db.exec('ROLLBACK; PRAGMA foreign_keys = ON;');
            console.error(`[db] Migracija ${v + 1} nije uspela:`, e);
            process.exit(1);
        }
    }
}
