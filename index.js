// index.js
require("dotenv").config();
const MY_TOKEN = process.env.GITHUB_TOKEN;

const express = require('express');
const app = express();
const port = 3000;
const host = '0.0.0.0'
const expressLayouts = require('express-ejs-layouts');
// Vraćeno na originalni paket 'sqlite'
const sqlite = require('sqlite'); 
const sqlite3 = require('sqlite3'); 
let db;
let server;

const fs = require('fs');
const path = require('path');

// Trenutna verzija instalirane aplikacije.
const CURRENT_APP_VERSION = "2.1.0"; 
// URL putanja do eksternog JSON fajla sa informacijama o najnovijoj verziji.
const EXTERNAL_VERSION_URL = 'https://api.github.com/repos/YuMERA/component-tracker/contents/version_info.json';
// 2. Tvoj stalni token 
//const MY_TOKEN = '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';
// ==============================
// UPDATE STATE (MORA BITI OVDE)
// ==============================
let updateState = {
    updateAvailable: false,
    latestVersion: null,
    downloadLink: null,
    versions: [],
    lastChecked: null,
    error: null
};

// ****************************
// 1. INICIJALIZACIJA BAZE PODATAKA
// ****************************

async function initializeDb() {
    try {
        // Otvaranje konekcije sa bazom podataka
        db = await sqlite.open({
            filename: './inventory.db', 
            driver: sqlite3.Database
        });

        console.log('Baza podataka uspešno povezana i spremna.');

        // 1. Tabela KOMPONENTI
        // NAPOMENA: SQL je ovde proveren i ispravan
        await db.exec(`
            CREATE TABLE IF NOT EXISTS components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                part_number TEXT UNIQUE,
                quantity INTEGER NOT NULL DEFAULT 0,
                min_stock INTEGER NOT NULL DEFAULT 0,
                location TEXT,
                category TEXT,
                description TEXT,
                datasheet_url TEXT,
                image_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Tabela KATEGORIJA (NOVO)
        // NAPOMENA: SQL je proveren i ispravan, osigurano od "nevidljivih" karaktera
        await db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
        `);
        
        console.log('Tabela components i categories su spremne.');

        // 3. Tabela API SERVISA
        await db.exec(`
            CREATE TABLE IF NOT EXISTS api_services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                api_key TEXT NOT NULL,
                additional_params TEXT,
                is_active INTEGER DEFAULT 0,  -- 1 ako je ovaj aktivan servis
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `)

        console.log('Tabela API servisa je spremne.');
        // Pokretanje Express servera nakon uspešne inicijalizacije baze
    } catch (error) {
        // Kritičan log u slučaju greške
        console.error('KRITIČNA GREŠKA pri inicijalizaciji baze podataka:', error);
        process.exit(1);
    }
}

//*****************************
// računa "ago" format
//*****************************

function timeAgo(timestamp) {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffH < 24) return `${diffH} hours ago`;
    return `${diffD} days ago`;
}

//***********************************
//   Formatiranje datuma i vremena
//***********************************

function formatCustomDate(date) {
    const day = String(date.getDate()).padStart(2, '0');

    const months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
    ];
    const month = months[date.getMonth()];

    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}-${month}-${year}, ${hours}:${minutes}:${seconds}`;
}

// *******************************
// Provera nove verzije za update
// *******************************
const semver = require('semver');

async function checkForUpdates() {
    try {
        /*// Za sada može lokalni fajl ili fetch kasnije
        const jsonPath = path.join(__dirname, 'version_info.json');
        const data = JSON.parse(
            await fs.promises.readFile(jsonPath, 'utf-8')
        );*/
        
        // TODO: Remove token when repository becomes public
        
        const token = MY_TOKEN;
        const response = await fetch(EXTERNAL_VERSION_URL, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3.raw' // vraća raw JSON
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch update info');
        }
        const data = await response.json();

        updateState.latestVersion = data.latest_version;
        updateState.downloadLink = data.download_url || null;
        updateState.versions = data.versions || [];
        updateState.updateAvailable =
            semver.gt(data.latest_version, CURRENT_APP_VERSION);

        updateState.lastChecked = new Date();
        updateState.error = null;

        console.log('[update] Current:', CURRENT_APP_VERSION);
        console.log('[update] Latest:', data.latest_version);
        console.log('[update] Update available:', updateState.updateAvailable);

    } catch (err) {
        updateState.error = err.message;
    }
}

// ✔ POZIV JEDNOM (pri startu aplikacije)
// Update check is performed once at application startup
checkForUpdates();

// ****************************
// 2. EXPRESS KONFIGURACIJA (Middleware)
// ****************************

app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());
app.use((req, res, next) => {
    res.locals.currentCategory = req.query.category || null;
    res.locals.currentStatus = req.query.status || null;
    res.locals.currentPath = req.path;
    res.locals.currentView = req.query.view === 'grid' ? 'grid' : 'list';

    const qs = new URLSearchParams(req.query);
    qs.delete('message');
    qs.delete('error');
    qs.delete('view');
    res.locals.queryString = qs.toString() || null;

    // UPDATE SIGNAL (layout global)
    res.locals.updateAvailable = updateState.updateAvailable;
    res.locals.latestVersion = updateState.latestVersion;
    res.locals.appVersion = CURRENT_APP_VERSION;
    
    next();
});

// RUTA: Dashboard
app.get('/', async (req, res) => {
    // 1. Dohvaćanje statistike za Dashboard
    
    // Dohvaćanje UKUPNE KOLIČINE (SUMA svih quantity) - Ovo je Primarni Veliki Broj (Total Items)
    const totalQuantityResult = await db.get('SELECT SUM(quantity) AS sum FROM components');

    // Dohvaćanje BROJA JEDINSTVENIH KOMPONENTI (COUNT) - Ovo je Sekundarni Mali Broj (Unique Components)
    const uniqueComponentsCount = await db.get('SELECT COUNT(id) AS count FROM components'); 
    
    const totalDefinedCategories = await db.get('SELECT COUNT(id) AS count FROM categories');
    
    const lowStockCount = await db.get('SELECT COUNT(*) AS count FROM components WHERE quantity <= min_stock AND min_stock > 0');
    const outOfStockCount = await db.get('SELECT COUNT(*) AS count FROM components WHERE quantity = 0');

    // 2. Dohvaćanje 5 najnovije dodatih komponenti
    let recentComponents = await db.all('SELECT * FROM components ORDER BY id DESC LIMIT 5');
    // Ovde formatiramo created_at
    recentComponents = recentComponents.map(component => {
        return {
            ...component,
            formatted_created_at: formatCustomDate(new Date(component.created_at))
        };
    });

    // 3. Dohvaćanje 5 najkritičnijih Low Stock komponenti
    const criticalLowStock = await db.all(
        `SELECT id, name, part_number, quantity, min_stock, image_url FROM components 
         WHERE quantity <= min_stock AND min_stock > 0 
         ORDER BY quantity ASC 
         LIMIT 5`
    );

    const stats = {
        // Sada je 'totalQuantity' za ukupan zbir količina (SUM)
        totalQuantity: totalQuantityResult.sum || 0,
        // Sada je 'totalComponents' za broj jedinstvenih komponenti (COUNT)
        totalComponents: uniqueComponentsCount.count || 0,
        // Korišćen ukupan broj definisanih kategorija
        categories: totalDefinedCategories.count || 0, 
        lowStock: lowStockCount.count || 0,
        outOfStock: outOfStockCount.count || 0
    };
    
    res.render('dashboard', {
        pageTitle: 'Dashboard | Component Tracker',
        stats,
        recentComponents,
        criticalLowStock,
        status: null
    });
});

app.post('/admin/categories/add', async (req, res) => {
    const name = req.body.name?.trim();

    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    try {
        await db.run(
            'INSERT INTO categories (name) VALUES (?)',
            [name]
        );

        res.json({ success: true });

    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Category already exists' });
        }

        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// RUTA: Kreiranje nove kategorije 
app.post('/admin/categories/add-json', async (req, res) => {
    const name = req.body.name ? req.body.name.trim() : null;

    if (!name) {
        return res.status(400).json({ error: 'Category name is required.' });
    }

    try {
        await db.run('INSERT INTO categories (name) VALUES (?)', [name]);
        res.json({ success: true, name });
    } catch (error) {
        let errorMessage = 'Failed to add category.';
        if (error.message.includes('UNIQUE constraint failed')) {
            errorMessage = `Category "${name}" already exists.`;
        }
        console.error('Error adding category:', error);
        res.status(400).json({ error: errorMessage });
    }
});

// RUTA: Prikaz svih kategorija sa pagination + search
app.get('/categories', async (req, res) => {
    const searchQuery = req.query.search || '';
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const rawLimit = req.query.limit;
    const limit = rawLimit === 'All' ? null : Math.max(parseInt(rawLimit) || 10, 1);
    const offset = limit ? (page - 1) * limit : 0;

    try {
        // 1. COUNT QUERY (za pagination)
        let countSql = `
            SELECT COUNT(*) as total
            FROM (
                SELECT cat.name
                FROM categories cat
                LEFT JOIN components c ON cat.name = c.category
                ${searchQuery ? 'WHERE cat.name LIKE ?' : ''}
                GROUP BY cat.name
            ) sub
        `;

        const countParams = searchQuery ? [`%${searchQuery}%`] : [];
        const countResult = await db.get(countSql, countParams);

        const totalItems = countResult.total;
        const totalPages = limit ? Math.ceil(totalItems / limit) : 1;

        const currentPage = Math.min(page, totalPages || 1);

        // 2. MAIN DATA QUERY
        let sql = `
            SELECT 
                cat.name AS category, 
                COUNT(c.id) as count 
            FROM categories cat
            LEFT JOIN components c ON cat.name = c.category
        `;

        let params = [];

        if (searchQuery) {
            sql += ' WHERE cat.name LIKE ?';
            params.push(`%${searchQuery}%`);
        }

        sql += `
            GROUP BY cat.name
            ORDER BY cat.name ASC
        `;

        if (limit) {
            sql += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }

        const categories = await db.all(sql, params);

        res.render('categories', {
            pageTitle: searchQuery
                ? `Search: "${searchQuery}" | Component Tracker`
                : 'Component Categories | Component Tracker',

            categories,

            // ⬇️ pagination props
            searchQuery,
            currentPage,
            totalPages,
            totalItems,
            limit,
            queryString: null
        });

    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Internal Server Error loading categories.');
    }
});

// RUTA: BRISANJE KATEGORIJE
app.get('/categories/delete/:name', async (req, res) => {
    // decodeURIComponent za bezbedno rukovanje specijalnim karakterima i razmacima
    const categoryName = decodeURIComponent(req.params.name);

    // Vraćamo korisnika tačno na stranicu sa koje je došao (page, limit, search…)
    // Vraćamo korisnika na prethodnu stranu,
    // ali uklanjamo stare message/error parametre
    let backUrl = req.get('referer') || '/categories';

    try {
        const url = new URL(backUrl, 'http://localhost');
        url.searchParams.delete('message');
        url.searchParams.delete('error');
        backUrl = url.pathname + url.search;
    } catch (e) {
        backUrl = '/categories';
    }

    const separator = backUrl.includes('?') ? '&' : '?';

    const category = await db.get(
        'SELECT id FROM categories WHERE name = ?',
        categoryName
    );

    // Kategorija ne postoji
    if (!category) {
        return res.redirect(
            backUrl + separator +
            'error=' + encodeURIComponent('delete_not_found')
        );
    }

    // Ne dozvoljavamo brisanje "Uncategorized" kategorije
    if (categoryName === 'Uncategorized') {
        return res.redirect(
            backUrl + separator +
            'error=' + encodeURIComponent('delete_forbidden')
        );
    }

    try {
        // 1. Sve komponente koje koriste ovu kategoriju postavljamo na NULL (uncategorized)
        await db.run(
            'UPDATE components SET category = NULL WHERE category = ?',
            categoryName
        );
        console.log(`Updated components: ${categoryName} set to uncategorized.`);

        // 2. Brišemo kategoriju iz tabele categories
        await db.run(
            'DELETE FROM categories WHERE name = ?',
            categoryName
        );
        console.log(`Category deleted: ${categoryName}`);

        // 3. Povratak na listu kategorija sa porukom o uspehu
        return res.redirect(
            backUrl + separator +
            'message=' + encodeURIComponent('delete_success') +
            '&name=' + encodeURIComponent(categoryName)
        );        

    } catch (error) {
        console.error('Greška pri brisanju kategorije:', error);

        // Greška prilikom rada sa bazom ili neočekivana greška
        return res.redirect(
            backUrl + separator +
            'error=' + encodeURIComponent('delete_error')
        );
    }
});

// RUTA: Izmena naziva kategorije (EDIT)
app.post('/categories/edit', async (req, res) => {
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        // 1. Update category name
        await db.run(
            'UPDATE categories SET name = ? WHERE name = ?',
            [newName, oldName]
        );

        // 2. Update all components that use this category
        await db.run(
            'UPDATE components SET category = ? WHERE category = ?',
            [newName, oldName]
        );

        await db.run('COMMIT');

        res.json({ success: true });

    } catch (err) {
        await db.run('ROLLBACK');

        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// RUTA: JSON API za dobijanje liste kategorija
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await db.all('SELECT name FROM categories ORDER BY name ASC');
        res.json(categories); // Vraća [{name: 'Resistors'}, {name: 'Capacitors'}, ...]
    } catch (error) {
        console.error('Error fetching categories JSON:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

/// RUTA: Brisanje komponente (DELETE)
app.get('/components/delete/:id', async (req, res) => {
    const componentId = req.params.id;

    // postojeći query string (page, limit, filters, search...)
    const qs = new URLSearchParams(req.query);

    // poruke ne vraćamo kao deo konteksta liste
    qs.delete('message');
    qs.delete('error');

    try {
        await db.run('DELETE FROM components WHERE id = ?', [componentId]);

        // dodaj success poruku
        qs.set('message', 'components.delete_success');

        const redirectUrl = qs.toString()
            ? `/components?${qs.toString()}`
            : '/components?message=components.delete_success';

        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Error deleting component:', error);

        // success → error
        qs.set('error', 'components.delete_failed');

        const redirectUrl = qs.toString()
            ? `/components?${qs.toString()}`
            : '/components?error=components.delete_failed';

        res.redirect(redirectUrl);
    }
});

// RUTA: Prikaz forme za izmenu (GET)
app.get('/components/edit/:id', async (req, res) => {
    const componentId = req.params.id;

    // dohvat aktivnog API servisa
    const activeService = await db.get(
        'SELECT * FROM api_services WHERE is_active = 1'
    );

    try {
        const component = await db.get('SELECT * FROM components WHERE id = ?', [componentId]);
        const categories = await db.all('SELECT name FROM categories ORDER BY name ASC'); 

        if (!component) {
            return res.status(404).send('Component not found for editing.');
        }

        const queryString = new URLSearchParams(req.query).toString();

        res.render('add-new', { // Koristimo istu formu
            pageTitle: 'Edit | Component Tracker',
            component: component, // Prosleđujemo ceo objekat
            categories: categories, // PROSLEĐUJEMO KATEGORIJE
            message: null,
            activeService,
            error: null,
            justAdded: req.query.added === '1',
            formData: null,
            queryString
        });
    } catch (error) {
        console.error('Error fetching component for edit:', error);
        res.status(500).send('Internal Server Error.');
    }
});

// RUTA: Obrada izmene komponente (POST)
app.post('/components/edit/:id', async (req, res) => {
    const componentId = req.params.id;

    const {
        name,
        part_number,
        quantity,
        min_stock,
        location,
        category,
        description,
        datasheet_url,
        image_url
    } = req.body;

    // dohvat aktivnog API servisa
    const activeService = await db.get(
        'SELECT * FROM api_services WHERE is_active = 1'
    );

    try {
        // =========================
        // VALIDACIJA – OBAVEZNA POLJA
        // =========================
        if (!name || quantity == null || min_stock == null) {
            const categories = await db.all(
                'SELECT name FROM categories ORDER BY name ASC'
            );
            const component = await db.get(
                'SELECT * FROM components WHERE id = ?',
                [componentId]
            );

            return res.render('add-new', {
                pageTitle: 'Edit Component | Component Tracker',
                component,
                categories,
                error: 'add.edit.error.required_fields',
                activeService,
                message: null,
                justAdded: false,
                formData: null,
                queryString: null
            });
        }

        // ==================================
        // VALIDACIJA – UNIQUE part_number
        // ==================================
        if (part_number) {
            const existing = await db.get(
                'SELECT id FROM components WHERE part_number = ? AND id != ?',
                [part_number, componentId]
            );

            if (existing) {
                const categories = await db.all(
                    'SELECT name FROM categories ORDER BY name ASC'
                );
                const component = await db.get(
                    'SELECT * FROM components WHERE id = ?',
                    [componentId]
                );

                return res.render('add-new', {
                    pageTitle: 'Edit Component | Component Tracker',
                    component,
                    categories,
                    error: 'add.edit.error.part_number_exists',
                    activeService,
                    message: null,
                    justAdded: false,
                    formData: null,
                    queryString: null
                });
            }
        }

        // =========================
        // UPDATE
        // =========================
        await db.run(
            `UPDATE components SET 
                name = ?, 
                part_number = ?, 
                quantity = ?, 
                min_stock = ?, 
                location = ?, 
                category = ?, 
                description = ?, 
                datasheet_url = ?, 
                image_url = ?
             WHERE id = ?`,
            [
                name,
                part_number || null,
                parseInt(quantity, 10),
                parseInt(min_stock, 10),
                location || null,
                category || null,
                description || null,
                datasheet_url || null,
                image_url || null,
                componentId
            ]
        );

        // =========================
        // POVRATAK NA LISTU
        // =========================
        const qs = new URLSearchParams(req.query);
        qs.delete('message');
        qs.delete('error');
        qs.set('message', 'components.edit_success');

        const redirectUrl = qs.toString()
            ? `/components?${qs.toString()}`
            : '/components?message=components.edit_success';

        res.redirect(redirectUrl);

    } catch (err) {
        console.error('Database Update Error:', err);

        let errorKey = 'add.edit.error.save_failed';

        if (
            err.message &&
            err.message.includes('UNIQUE constraint failed: components.part_number')
        ) {
            errorKey = 'add.edit.error.part_number_exists';
        }

        const categories = await db.all(
            'SELECT name FROM categories ORDER BY name ASC'
        );
        const component = await db.get(
            'SELECT * FROM components WHERE id = ?',
            [componentId]
        );

        res.render('add-new', {
            pageTitle: 'Edit Component | Component Tracker',
            component,
            categories,
            error: errorKey,
            activeService,
            message: null,
            justAdded: false,
            formData: null,
            queryString: null
        });
    }
});

// RUTA: Prikaz detalja komponente (READ ONE)
app.get('/components/details/:id', async (req, res) => {
    const componentId = req.params.id;
    // dohvat aktivnog API servisa    
    try {
        const component = await db.get('SELECT * FROM components WHERE id = ?', [componentId]);

        if (!component) {
            return res.status(404).render('404', { pageTitle: 'Not Found | Component Tracker' });
        }
        
        const queryString = new URLSearchParams(req.query).toString() || null;

        // NOVO: Prosleđujemo CEO 'req' objekat EJS fajlu!
        res.render('details', {
            pageTitle: 'Details | Component Tracker',
            component: component,
            req: req,
            queryString
        });

    } catch (error) {
        console.error('Error fetching component details:', error);
        res.status(500).send('Internal Server Error');
    }
});

// RUTA: Prikaz svih komponenti (READ) sa pagination
app.get('/components', async (req, res) => {
    const filterCategory = req.query.category || null;
    const filterStatus = req.query.status;
    const searchQuery = req.query.search; 
    const successMessage = req.query.message;
    const errorMessage = req.query.error;
    
    const view = req.query.view === 'grid' ? 'grid' : 'list';
    // PAGINATION: page i limit
    const page = parseInt(req.query.page) || 1;
    //const limit = req.query.limit === 'All' ? null : parseInt(req.query.limit) || 10;

    let limit;

    if (req.query.limit === 'All') {
        limit = null;
    } else if (req.query.limit) {
        limit = parseInt(req.query.limit, 10);
    } else {
        // DEFAULT BEHAVIOR
        limit = view === 'grid' ? 20 : 10;
    }

    let sqlParams = [];
    let whereClauses = [];
    let pageTitleSuffix = 'All Components';

    // =========================
    // 1. PRETRAGA (simple, predictable)
    // =========================
    if (searchQuery) {
        const tokens = searchQuery
            .split(/\s+/)
            .map(t => t.trim())
            .filter(Boolean);

        for (const token of tokens) {
            const pattern = `%${token}%`;
            whereClauses.push(
                '(name LIKE ? OR part_number LIKE ? OR location LIKE ? OR description LIKE ? OR category LIKE ?)'
            );
            sqlParams.push(pattern, pattern, pattern, pattern, pattern);
        }

        pageTitleSuffix = `Search: "${searchQuery}"`;
    }

    // =========================
    // 2. FILTER KATEGORIJA
    // =========================
    if (filterCategory) {
        if (filterCategory === 'Uncategorized') {
            whereClauses.push('(category IS NULL OR category = "")');
        } else {
            whereClauses.push('category = ?');
            sqlParams.push(filterCategory);
        }
        if (!searchQuery) pageTitleSuffix = `${filterCategory} Components`;
    }

    // =========================
    // 3. FILTER STATUS
    // =========================
    if (filterStatus === 'out-of-stock') {
        whereClauses.push('quantity = 0');
        if (!searchQuery && !filterCategory) pageTitleSuffix = 'Out of Stock Components';
    }

    if (filterStatus === 'low-stock') {
        whereClauses.push('quantity <= min_stock AND min_stock > 0');
        if (!searchQuery && !filterCategory) pageTitleSuffix = 'Low Stock Components';
    }

    // =========================
    // 4. COUNT (pagination)
    // =========================
    let countQuery = 'SELECT COUNT(*) as total FROM components';
    if (whereClauses.length > 0) {
        countQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    try {
        const countResult = await db.get(countQuery, sqlParams);
        const totalItems = countResult.total;
        const totalPages = limit ? Math.ceil(totalItems / limit) : 1;

        // UX zaštita
        if (page > totalPages && totalPages > 0) {
            const query = new URLSearchParams({
                ...(filterCategory && { category: filterCategory }),
                ...(filterStatus && { status: filterStatus }),
                ...(searchQuery && { search: searchQuery }),
                ...(limit && { limit }),
                page: totalPages
            }).toString();

            return res.redirect(`/components?${query}`);
        }

        const offset = limit ? (page - 1) * limit : 0;

        // =========================
        // 5. GLAVNI SELECT
        // =========================
        let sqlQuery = 'SELECT * FROM components';
        if (whereClauses.length > 0) {
            sqlQuery += ' WHERE ' + whereClauses.join(' AND ');
        }
        sqlQuery += ' ORDER BY name ASC';
        if (limit) sqlQuery += ' LIMIT ? OFFSET ?';

        const finalParams = limit ? [...sqlParams, limit, offset] : sqlParams;
        const components = await db.all(sqlQuery, finalParams);

        // =========================
        // QUERY STRING HELPERS
        // =========================
        const qs = new URLSearchParams(req.query);
        qs.delete('message');
        qs.delete('error');
        const queryString = qs.toString();

        const queryWithoutSearch = new URLSearchParams(
            Object.fromEntries(
                Object.entries(req.query).filter(([key]) => key !== 'search')
            )
        );
        queryWithoutSearch.set('page', 1);
        const clearSearchQueryString = queryWithoutSearch.toString();

        // =========================
        // 6. RENDER
        // =========================
        res.render('all-components', {
            pageTitle: `${pageTitleSuffix} | Component Tracker`,
            components,
            currentCategory: filterCategory,
            currentStatus: filterStatus,
            searchQuery,
            message: successMessage,
            error: errorMessage,
            currentPage: page,
            totalPages,
            limit,
            totalItems,
            justAdded: req.query.added === '1',
            queryString,
            clearSearchQueryString
        });

    } catch (error) {
        console.error('Error fetching components:', error);
        res.render('all-components', {
            pageTitle: 'All Components | Component Tracker',
            components: [],
            error: 'Failed to load components from database.',
            currentPage: 1,
            totalPages: 1,
            limit: 10,
            totalItems: 0,
            justAdded: req.query.added === '1',
            queryString: ''
        });
    }
});

// RUTA: Prikaz forme za dodavanje nove komponente (GET)
app.get('/components/new', async (req, res) => { // Dodat async
    const categories = await db.all('SELECT name FROM categories ORDER BY name ASC');

    // dohvat aktivnog API servisa
    const activeService = await db.get(
        'SELECT * FROM api_services WHERE is_active = 1'
    );

    res.render('add-new', {
        pageTitle: 'Add New Component | Component Tracker',
        message: null,
        error: null,
        categories, // PROSLEĐUJEMO KATEGORIJE
        activeService,
        isEdit: false,
        justAdded: req.query.added === '1',
        formData: null
    });
});

// RUTA: Obrada forme za dodavanje nove komponente (POST)
app.post('/components/new', async (req, res) => {
    const { name, part_number, quantity, min_stock, location, category, description, datasheet_url, image_url } = req.body;

    // dohvat aktivnog API servisa
    const activeService = await db.get(
        'SELECT * FROM api_services WHERE is_active = 1'
    );

    // Provera obaveznih polja
    if (!name || !part_number || !category) {
        const categories = await db.all('SELECT name FROM categories ORDER BY name ASC');

        return res.render('add-new', { 
            pageTitle: 'Add New Component | Component Tracker',
            
            // i18n key
            error: 'add.error.required_fields',

            message: null,
            categories: categories,
            activeService,
            justAdded: req.query.added === '1',
            // vraćamo unete podatke
            formData: req.body
        });
    }

    try {
        const result = await db.run(
            `INSERT INTO components 
             (name, part_number, quantity, min_stock, location, category, description, datasheet_url, image_url, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`, 
            [
                name, 
                part_number || null,
                parseInt(quantity), 
                parseInt(min_stock), 
                location || null, 
                category || null, 
                description || null, 
                datasheet_url || null, 
                image_url || null
            ]
        );

        // Preusmeravanje nazad na Add New formu (Add another workflow)
        res.redirect('/components/new?added=1');

    } catch (err) {

        let errorKey = 'add.error.save_failed';

        if (err.message && err.message.includes('UNIQUE constraint failed: components.part_number')) {

            errorKey = 'add.error.part_number_exists';
        }

        console.error("Database Insert Error:", err);
        
        const categories = await db.all('SELECT name FROM categories ORDER BY name ASC');

        res.render('add-new', { 
            pageTitle: 'Add New Component | Component Tracker',
            error: errorKey,
            message: null,
            categories: categories,
            activeService,
            justAdded: req.query.added === '1',
            formData: req.body
        });
    }
});

app.get('/components/export/csv', async (req, res) => {
    const filterCategory = req.query.category || null;
    const filterStatus = req.query.status || null;
    const searchQuery = req.query.search || null;

    let whereClauses = [];
    let sqlParams = [];

    // === SEARCH (simple tokens, isto kao lista) ===
    if (searchQuery) {
        const tokens = searchQuery
            .split(/\s+/)
            .map(t => t.trim())
            .filter(Boolean);

        for (const token of tokens) {
            const pattern = `%${token}%`;
            whereClauses.push(
                '(name LIKE ? OR part_number LIKE ? OR location LIKE ? OR description LIKE ? OR category LIKE ?)'
            );
            sqlParams.push(pattern, pattern, pattern, pattern, pattern);
        }
    }

    // === CATEGORY ===
    if (filterCategory) {
        if (filterCategory === 'Uncategorized') {
            whereClauses.push('(category IS NULL OR category = "")');
        } else {
            whereClauses.push('category = ?');
            sqlParams.push(filterCategory);
        }
    }

    // === STATUS ===
    if (filterStatus === 'out-of-stock') {
        whereClauses.push('quantity = 0');
    }

    if (filterStatus === 'low-stock') {
        whereClauses.push('quantity <= min_stock AND min_stock > 0');
    }

    // === SQL ===
    let sqlQuery = `
        SELECT
            name,
            part_number,
            category,
            location,
            quantity,
            min_stock,
            description
        FROM components
    `;

    if (whereClauses.length) {
        sqlQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    sqlQuery += ' ORDER BY name ASC';

    try {
        const rows = await db.all(sqlQuery, sqlParams);

        // === CSV HEADER ===
        const header = [
            'Name',
            'Part Number',
            'Category',
            'Location',
            'Quantity',
            'Min Stock',
            'Description'
        ];

        // === CSV ESCAPE ===
        const csvEscape = (val) => {
            const str = String(val ?? '')
                .replace(/"/g, '""')     // escape quotes
                .replace(/\r?\n+/g, ' | '); // flatten newlines
        
            return `"${str}"`;
        };

        const csvLines = [
            header.join(','),
            ...rows.map(row =>
                [
                    row.name,
                    row.part_number,
                    row.category,
                    row.location,
                    row.quantity,
                    row.min_stock,
                    row.description
                ].map(csvEscape).join(',')
            )
        ];

        const csvContent = csvLines.join('\n');

        // === RESPONSE ===
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="components_export.csv"'
        );

        res.send(csvContent);

    } catch (err) {
        console.error('CSV export failed:', err);
        res.status(500).send('CSV export failed');
    }
});

// RUTA: Tekstualni izvoz liste komponenti
app.get('/components/export/list', async (req, res) => {
    const filterCategory = req.query.category || null;
    const filterStatus = req.query.status || null;
    const searchQuery = req.query.search || null;

    let whereClauses = [];
    let sqlParams = [];

    // SEARCH — MUST MATCH UI SEMANTICS (AND between tokens)
    if (searchQuery) {
        const tokens = searchQuery
            .split(/\s+/)
            .map(t => t.trim())
            .filter(Boolean);

        // ISTA LOGIKA KAO U /components RUTI
        for (const token of tokens) {
            const pattern = `%${token}%`;
            whereClauses.push(
                '(name LIKE ? OR part_number LIKE ? OR location LIKE ? OR category LIKE ? OR description LIKE ?)'
            );
            sqlParams.push(pattern, pattern, pattern, pattern, pattern);
        }
    }

    // CATEGORY
    if (filterCategory) {
        if (filterCategory === 'Uncategorized') {
            whereClauses.push('(category IS NULL OR category = "")');
        } else {
            whereClauses.push('category = ?');
            sqlParams.push(filterCategory);
        }
    }

    // STATUS
    if (filterStatus === 'out-of-stock') {
        whereClauses.push('quantity = 0');
    }

    if (filterStatus === 'low-stock') {
        whereClauses.push('quantity <= min_stock AND min_stock > 0');
    }

    let sqlQuery = `
        SELECT
            name,
            category,
            location,
            quantity
        FROM components
    `;

    if (whereClauses.length) {
        sqlQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    sqlQuery += ' ORDER BY name ASC';

    try {
        const rows = await db.all(sqlQuery, sqlParams);

        const today = new Date().toISOString().split('T')[0];

        // column widths (A4 friendly)
        const COLS = {
            no: 4,
            name: 26,
            category: 25,
            location: 24,
            qty: 5
        };

        const pad = (str, len) =>
            String(str ?? '')
                .slice(0, len)
                .padEnd(len, ' ');

        const line = '-'.repeat(
            COLS.no +
            COLS.name +
            COLS.category +
            COLS.location +
            COLS.qty +
            5
        );
        
        const titleParts = [];

        // Category
        if (filterCategory) {
            titleParts.push(filterCategory);
        } else {
            titleParts.push('All Components');
        }

        // Status
        if (filterStatus === 'low-stock') {
            titleParts.push('Low Stock');
        }

        if (filterStatus === 'out-of-stock') {
            titleParts.push('Out of Stock');
        }

        // Search
        if (searchQuery) {
            titleParts.push(`Search: ${searchQuery}`);
        }

        const titleLine = titleParts.join(' | ');

        let output = '';
        //output += `Workshop Inventory – ${filterCategory || 'All Components'}\n`;
        output += `Workshop Inventory – ${titleLine}\n`;
        output += `Generated: ${today}\n`;
        output += `${line}\n`;
        output +=
            pad('No', COLS.no) +
            pad('Name', COLS.name) +
            pad('Category', COLS.category) +
            pad('Location', COLS.location) +
            pad('Qty', COLS.qty) +
            '\n';
        output += `${line}\n`;

        rows.forEach((row, idx) => {
            output +=
                pad(idx + 1, COLS.no) +
                pad(row.name, COLS.name) +
                pad(row.category, COLS.category) +
                pad(row.location, COLS.location) +
                pad(row.quantity, COLS.qty) +
                '\n';
        });

        output += `${line}\n`;
        output += `Total items: ${rows.length}\n`;


        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="workshop_inventory_list.txt"'
        );

        res.send(output);

    } catch (err) {
        console.error('List export failed:', err);
        res.status(500).send('List export failed');
    }
});

// RUTA: SETTINGS PAGE
app.get('/settings', async (req, res) => {
    // Prosleđujemo placeholder vrednosti za temu i jezik, za sada
    res.render('settings', {
        pageTitle: 'Settings | Component Tracker',
        currentTheme: 'System', // Placeholder
        currentLanguage: 'En'   // Placeholder (Koristićemo 'Sr' ili 'En')
    });
});

// --- RUTA ZA PROVERU AŽURIRANJA ---
app.get('/settings/update', (req, res) => {

    // Inicijalizacija podataka za renderovanje
    const renderData = { 
        pageTitle: 'Updates | Component Tracker',

        // Trenutna verzija aplikacije
        currentVersion: CURRENT_APP_VERSION,

        // PODACI IZ CENTRALNOG UPDATE STATE-a
        latestVersion: updateState.latestVersion || CURRENT_APP_VERSION,
        updateAvailable: updateState.updateAvailable || false,
        downloadLink: updateState.downloadLink || '',

        // Detalji verzija (ako postoje)
        versions: updateState.versions || [],

        // Placeholder-i
        latestVersionInfo: null,
        currentVersionInfo: { title: 'No details', features: [] },

        // Greška ako postoji
        error: updateState.error || null
    };

    try {
        const allVersions = renderData.versions;

        // Detalji za najnoviju verziju
        if (renderData.latestVersion && allVersions.length > 0) {
            renderData.latestVersionInfo =
                allVersions.find(v => v.version === renderData.latestVersion)
                || { title: "Not available", features: [] };
        }

        // Detalji za trenutnu verziju
        renderData.currentVersionInfo =
            allVersions.find(v => v.version === CURRENT_APP_VERSION)
            || {
                title: "No details found",
                features: ["There is no description for the installed version."]
            };

    } catch (error) {
        console.error('[update] Render error:', error.message);
        renderData.error = `Data processing error: ${error.message}`;
    }

    // Renderovanje templejta
    res.render('update-check', renderData);
});

// --- RUTA ZA BACKUP BAZE PODATAKA ---
// GET ruta — prikazuje backup stranicu
app.get('/backup', (req, res) => {
    const dbPath = path.join(__dirname, 'inventory.db');
    const backupFolder = path.join(__dirname, 'backups');

    let dbSize = 0;
    try {
        dbSize = Math.round(fs.statSync(dbPath).size / 1024);
    } catch (err) {
        console.error("DB size read error:", err);
    }

    // Tražimo zadnji backup
    let lastBackup = "No backups yet";
    let timePassed = null;

    try {
        if (fs.existsSync(backupFolder)) {
            const files = fs.readdirSync(backupFolder)
                .filter(f => f.endsWith(".db"))
                .map(f => ({
                    name: f,
                    time: fs.statSync(path.join(backupFolder, f)).mtime.getTime(),
                    date: fs.statSync(path.join(backupFolder, f)).mtime
                }))
                .sort((a, b) => b.time - a.time);

            if (files.length > 0) {
                lastBackup = `${files[0].name} [${formatCustomDate(files[0].date)}]`;
                timePassed = timeAgo(files[0].time);
            }
        }
    } catch (err) {
        console.error("Backup scan error:", err);
    }

    res.render('backup', { 
        layout: 'layout',
        pageTitle: "Backup | Component Tracker",
        dbSize,
        lastBackup,
        timePassed,
        pathDB: backupFolder,
        message: null,
        msgType: null,
        backupFileName: null,
        messageKey: null
    });
});

// POST ruta — pravi backup fajl
app.post('/backup', (req, res) => {
    const targetFolder = path.join(__dirname, 'backups');
    const dbPath = path.join(__dirname, 'inventory.db');

    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    const backupFileName = `inventory-backup-${Date.now()}.db`;
    const destPath = path.join(targetFolder, backupFileName);

    try {
        fs.copyFileSync(dbPath, destPath);
        // Postavi tačan timestamp na backup fajl
        const now = new Date();
        fs.utimesSync(destPath, now, now);

        const fileTime = fs.statSync(destPath).mtime.getTime();

        res.render('backup', {
            layout: 'layout',
            pageTitle: "Backup | Component Tracker",
            messageKey: 'backup.success.created',
            msgType: "success",
            dbSize: Math.round(fs.statSync(dbPath).size / 1024),
            lastBackup: `${backupFileName} [${formatCustomDate(new Date(fileTime))}]`,
            timePassed: timeAgo(fileTime),
            backupFileName,
            pathDB: targetFolder
        });

    } catch (err) {
        console.error("Backup error:", err);

        res.render('backup', {
            layout: 'layout',
            pageTitle: "Backup | Component Tracker",
            messageKey: 'backup.error.failed',
            msgType: "danger",
            dbSize: Math.round(fs.statSync(dbPath).size / 1024),
            lastBackup: "Unknown",
            timePassed: null,
            pathDB: targetFolder
        });
    }
});

//Rute za API servise
// GET: prikaz svih API servisa
app.get('/tools/api', async (req, res) => {
    const services = await db.all(`
        SELECT *
        FROM api_services
        ORDER BY name ASC
    `);
    const activeService = services.find(s => s.is_active === 1);
    res.render('tools-api', {
        pageTitle: 'API Services | Workshop Inventory',
        services,
        activeService
    });
});

// POST: dodavanje novog servisa
app.post('/tools/api/add', async (req, res) => {
    const { name, endpoint, api_key, additional_params } = req.body;
    await db.run(
        `INSERT INTO api_services (name, endpoint, api_key, additional_params) VALUES (?, ?, ?, ?)`,
        [name, endpoint, api_key, additional_params || null]
    );
    res.redirect('/tools/api');
});

// POST: menjanje aktivnog servisa
app.post('/tools/api/toggle', async (req, res) => {
    const { id, makeActive } = req.body;

    if (makeActive === '1') {
        // deaktiviraj sve
        await db.run('UPDATE api_services SET is_active = 0');
        // aktiviraj izabrani
        await db.run('UPDATE api_services SET is_active = 1 WHERE id = ?', [id]);
    } else {
        // samo deaktiviraj ovaj
        await db.run('UPDATE api_services SET is_active = 0 WHERE id = ?', [id]);
    }

    res.redirect('/tools/api');
});

// GET: edit API service form
app.get('/tools/api/edit/:id', async (req, res) => {
    const { id } = req.params;

    const service = await db.get(
        'SELECT * FROM api_services WHERE id = ?',
        [id]
    );

    if (!service) {
        return res.redirect('/tools/api');
    }

    res.render('tools-api-edit', {
        pageTitle: 'Edit API Service | Component Tracker',
        service
    });
});

// POST: edit servisa
app.post('/tools/api/edit', async (req, res) => {
    const { id, name, endpoint, api_key, additional_params, is_active } = req.body;

    const activeValue = is_active ? 1 : 0;
    if (activeValue === 1) {
        // ako ovaj postaje aktivan → svi ostali inactive
        await db.run('UPDATE api_services SET is_active = 0');
    }

    await db.run(
        `UPDATE api_services 
         SET name = ?, endpoint = ?, api_key = ?, additional_params = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [name, endpoint, api_key, additional_params || null, activeValue, id]
    );

    res.redirect('/tools/api');
});

// POST: delete API servisa
app.post('/tools/api/delete/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM api_services WHERE id=?', [id]);
    res.redirect('/tools/api');
});

// GET: pretraga dela preko aktivnog API servisa
const { resolveApiService } = require('./apiServices/serviceResolver');
const { URLSearchParams } = require('url');

app.get('/tools/api/find-part', async (req, res) => {
    try {
        const { part_number } = req.query;

        if (!part_number) {
            return res.json({ success: false, message: 'Part number is required' });
        }

        // Dobijamo aktivni API servis (Element14, Mouser...)
        const apiService = await resolveApiService(db);

        // Pozivamo standardnu metodu
        const result = await apiService.findPart(part_number);

        return res.json(result);

    } catch (err) {
        console.error('API Resolver Error:', err.message);
        return res.json({ success: false, message: err.message });
    }
});

//*********************************/
// Ruta: About
//*********************************/
app.get('/about', (req, res) => {
    const fs = require('fs');
    const path = require('path');

    let licenseText = '';
    try {
        licenseText = fs.readFileSync(path.join(__dirname, 'LICENSE'), 'utf8');
    } catch {
        licenseText = '';
    }

    res.render('about', {
        pageTitle: 'About | Component Tracker',
        licenseText
    });
});

// ****************************
// 4. POKRETANJE SERVERA (ROBUSTNO)
// ****************************
// Provereni, robustni lanac za inicijalizaciju i startovanje
initializeDb()
    .then(() => {
        // Ako je inicijalizacija uspešna, startuj server
        server = app.listen(port, host, () => {
            console.log(`Server pokrenut na http://localhost:${port}`);
            console.log('Aplikacija spremna za rad.');
        });
    })
    .catch(err => {
        // Ako inicijalizacija baze ne uspe, prikaži GREŠKU PRE POKRETANJA
        console.error('FATALNA GREŠKA PRI POKRETANJU APLIKACIJE:', err);
        // Izlaz iz procesa sa greškom
        process.exit(1); 
    });

// Robusni graceful shutdown
const FORCE_EXIT_TIMEOUT_MS = 10_000; // forsiraj exit posle 10s ako shutdown zapne
let isShuttingDown = false;

async function shutdown(signal, info) {
  if (isShuttingDown) {
    console.log('[shutdown] Already shutting down, ignoring duplicate signal:', signal);
    return;
  }
  isShuttingDown = true;

  console.log(`\n[shutdown] Received ${signal}. Starting graceful shutdown...`, info || '');
  const forceTimer = setTimeout(() => {
    console.error('[shutdown] Forcing exit after timeout.');
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);
  if (forceTimer.unref) forceTimer.unref();

  try {
    // 1) Stop accepting new connections
    if (server && typeof server.close === 'function') {
      console.log('[shutdown] Closing HTTP server...');
      await new Promise((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      });
      console.log('[shutdown] HTTP server closed.');
    }

    // 2) Close DB connection (sqlite Database ima .close())
    if (db && typeof db.close === 'function') {
      console.log('[shutdown] Closing database connection...');
      await db.close();
      console.log('[shutdown] Database connection closed.');
    }

    clearTimeout(forceTimer);
    console.log('[shutdown] Graceful shutdown completed. Exiting.');
    process.exit(0);

  } catch (err) {
    console.error('[shutdown] Error during shutdown:', err);
    process.exit(1);
  }
}

// Signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGQUIT', () => shutdown('SIGQUIT'));

// Unexpected errors: try graceful shutdown, then force exit
process.on('uncaughtException', (err) => {
  console.error('[shutdown] Uncaught Exception:', err);
  // prosledi err kao dodatni info (može pomoći u logu)
  shutdown('uncaughtException', err).catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[shutdown] Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection', reason).catch(() => process.exit(1));
});