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
        kind TEXT NOT NULL DEFAULT 'manual',   -- initial | manual | adjust | move | migrated (stari zapisi)
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
    CREATE TABLE api_services (
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

const MIGRATIONS = [
    // 1: početna šema
    db => {
        db.exec(SCHEMA_V1);
        db.exec(API_SERVICES);

        // Podrazumevani servisi (bez ključa) da se odmah vide u Podešavanjima
        const addService = db.prepare('INSERT INTO api_services (name, endpoint, api_key, is_active) VALUES (?, ?, ?, 0)');
        addService.run('element14', 'api.element14.com', '');
        addService.run('mouser', 'api.mouser.com', '');
    },

    // 2: prioritet izvora pri spajanju rezultata pretrage (manji broj = glavni izvor).
    //    Podrazumevano Mouser: tehnički podaci su mu potpuniji i pouzdaniji.
    db => {
        db.exec('ALTER TABLE api_services ADD COLUMN priority INTEGER NOT NULL DEFAULT 9');
        db.exec("UPDATE api_services SET priority = CASE name WHEN 'mouser' THEN 1 WHEN 'element14' THEN 2 ELSE 9 END");
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
