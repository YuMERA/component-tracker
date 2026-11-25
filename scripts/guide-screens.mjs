// *********************************************************************
// guide-screens.mjs – slike ekrana za Uputstvo (npm run guide:screens)
//
// 1. pokrene aplikaciju sa PRAZNIM privremenim folderom i upiše izmišljene demo
//    podatke (ništa iz tvoje baze, nikakvi pravi API ključevi)
//    --real: umesto demo podataka koristi KOPIJU tvoje baze (data/ ili --data <folder>);
//    original se ne dira, API ključevi u kopiji se menjaju izmišljenim, a pretraga online
//    se prikazuje iz rezultata koji su već sačuvani u bazi (bez poziva Mouser-u / Element14)
// 2. otvori Microsoft Edge bez prozora (headless) i preko DevTools protokola
//    klikće kroz aplikaciju i snima ekrane
// 3. slike idu u client/public/guide-shots/<jezik>/<naziv>.webp
//
// Kad se izgled aplikacije promeni, samo ponovo pokreni skriptu.
// Treba: Windows sa Edge-om (ili CHROME_PATH sa putanjom do Chrome/Edge).
// *********************************************************************
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3020;
const BASE = `http://localhost:${PORT}`;
const CDP_PORT = 9333;
const VIEW = { width: 1366, height: 800 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const REAL = process.argv.includes('--real');
const REAL_DATA = path.resolve(arg('--data') || path.join(ROOT, 'data'));
const REAL_PICK = arg('--pick') || 'SIR570DP-T1-RE3';  // komponenta za sliku panela i istorije
const REAL_LOOKUP = arg('--lookup') || 'USBLC6-2SC6';  // komponenta za sliku pretrage online (iz sačuvanih rezultata)

const BROWSER = process.env.CHROME_PATH || [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'
].find(p => fs.existsSync(p));
if (!BROWSER) throw new Error('Edge/Chrome nije pronađen – postavi CHROME_PATH');

// ---------------------------------------------------------------------
// Demo podaci (po jeziku – nazivi lokacija i kategorija)
// ---------------------------------------------------------------------
const T = {
    sr: {
        cab: 'Ormar A', d1: 'Fioka 1', d2: 'Fioka 2', d3: 'Fioka 3', smd: 'Kutija SMD', p1: 'Pregrada 1', p2: 'Pregrada 2',
        mod: 'Kutija modula', shelf: 'Polica',
        ic: 'Integrisana kola', mcu: 'Mikrokontroleri', tr: 'Tranzistori', di: 'Diode', res: 'Otpornici SMD',
        cap: 'Kondenzatori', reg: 'Regulatori napona', mods: 'Moduli', misc: 'Ostalo',
        led: 'LED 5 mm crvena', btn: 'Taster 6×6 mm', note: 'Za projekat sata'
    },
    en: {
        cab: 'Cabinet A', d1: 'Drawer 1', d2: 'Drawer 2', d3: 'Drawer 3', smd: 'SMD box', p1: 'Slot 1', p2: 'Slot 2',
        mod: 'Module box', shelf: 'Shelf',
        ic: 'Integrated circuits', mcu: 'Microcontrollers', tr: 'Transistors', di: 'Diodes', res: 'Resistors SMD',
        cap: 'Capacitors', reg: 'Voltage regulators', mods: 'Modules', misc: 'Other',
        led: 'LED 5 mm red', btn: 'Push button 6×6 mm', note: 'For the clock project'
    }
};

function demoRows(L) {
    const d1 = `${L.cab} › ${L.d1}`, d2 = `${L.cab} › ${L.d2}`, d3 = `${L.cab} › ${L.d3}`;
    const p1 = `${L.cab} › ${L.smd} › ${L.p1}`, p2 = `${L.cab} › ${L.smd} › ${L.p2}`, mod = `${L.shelf} › ${L.mod}`;
    // [naziv, MPN, proizvođač, kućište, kategorija, lokacija, kom, minimum, opis]
    return [
        ['NE555P', 'NE555P', 'Texas Instruments', 'DIP-8', L.ic, d1, 12, 5, 'Precision timer\n4.5 V – 16 V'],
        ['LM358N', 'LM358N', 'Texas Instruments', 'DIP-8', L.ic, d1, 3, 5, 'Dual op amp\n3 V – 32 V'],
        ['ATmega328P-PU', 'ATMEGA328P-PU', 'Microchip', 'DIP-28', L.mcu, d1, 2, 2, '8-bit AVR\n32 kB Flash\n20 MHz'],
        ['ESP32-WROOM-32E', 'ESP32-WROOM-32E-N4', 'Espressif', 'Module', L.mcu, mod, 4, 2, 'Wi-Fi + Bluetooth\n4 MB Flash'],
        ['IRFZ44N', 'IRFZ44NPBF', 'Infineon', 'TO-220AB', L.tr, d2, 10, 4, 'N-channel MOSFET\n55 V\n49 A\n17.5 mΩ'],
        ['BC547B', 'BC547BTA', 'onsemi', 'TO-92', L.tr, d2, 50, 20, 'NPN\n45 V\n100 mA'],
        ['BC557B', 'BC557BTA', 'onsemi', 'TO-92', L.tr, d2, 40, 20, 'PNP\n45 V\n100 mA'],
        ['2N7002', '2N7002,215', 'Nexperia', 'SOT-23', L.tr, p1, 100, 20, 'N-channel MOSFET\n60 V\n300 mA'],
        ['1N4007', '1N4007-T', 'Diodes Inc.', 'DO-41', L.di, d3, 80, 20, 'Rectifier\n1000 V\n1 A'],
        ['1N5819', '1N5819-T', 'Diodes Inc.', 'DO-41', L.di, d3, 0, 10, 'Schottky\n40 V\n1 A'],
        ['USBLC6-2SC6', 'USBLC6-2SC6', 'STMicroelectronics', 'SOT-23-6', L.di, p1, 15, 5, 'ESD protection\nUSB 2.0'],
        ['10k 0805', 'RC0805FR-0710KL', 'Yageo', '0805', L.res, p2, 400, 100, '10 kΩ\n1%\n125 mW'],
        ['4k7 0805', 'RC0805FR-074K7L', 'Yageo', '0805', L.res, p2, 250, 100, '4.7 kΩ\n1%\n125 mW'],
        ['100R 0805', 'RC0805FR-07100RL', 'Yageo', '0805', L.res, p2, 60, 100, '100 Ω\n1%\n125 mW'],
        ['100nF 0805', 'GRM21BR71H104KA01L', 'Murata', '0805', L.cap, p2, 300, 100, '100 nF\n50 V\nX7R'],
        ['100µF 16V', 'EEU-FR1C101', 'Panasonic', 'Radial', L.cap, d3, 25, 10, '100 µF\n16 V\n105 °C'],
        ['LM7805', 'LM7805CT', 'onsemi', 'TO-220', L.reg, d2, 6, 2, '5 V\n1 A'],
        ['AMS1117-3.3', 'AMS1117-3.3', 'AMS', 'SOT-223', L.reg, p1, 20, 5, '3.3 V\n1 A LDO'],
        ['HC-SR04', 'HC-SR04', '', 'Module', L.mods, mod, 2, 1, 'Ultrasonic distance sensor'],
        ['OLED 0.96" SSD1306', 'SSD1306-128X64', '', 'Module', L.mods, mod, 3, 1, '128×64\nI²C'],
        [L.led, '', '', '5 mm', L.misc, d3, 40, 10, ''],
        [L.btn, '', '', 'THT', L.misc, d3, 30, 10, '']
    ].map(([name, mpn, manufacturer, pkg, category, location, quantity, min, description]) =>
        ({ name, mpn, manufacturer, package: pkg, category, location, quantity: String(quantity), min_stock: String(min), description }));
}

// Izmišljen rezultat pretrage za NE555P (umesto pravog Mouser/Element14 odgovora)
function demoLookup(source) {
    const base = { source, lifecycle: 'Active', image_url: null, datasheet_url: null, category: 'Timers', product_url: 'https://example.com' };
    return [
        { ...base, mpn: 'NE555P', manufacturer: 'Texas Instruments', package: 'PDIP-8', description: 'Precision Timer, 4.5V to 16V, DIP-8', stock: source === 'mouser' ? 21500 : 8400 },
        { ...base, mpn: 'NE555PSR', manufacturer: 'Texas Instruments', package: 'SO-8', description: 'Precision Timer, SO-8, tape and reel', stock: source === 'mouser' ? 12000 : 3100 },
        { ...base, mpn: 'NE555PWR', manufacturer: 'Texas Instruments', package: 'TSSOP-8', description: 'Precision Timer, TSSOP-8, tape and reel', stock: source === 'mouser' ? 6400 : 0 }
    ];
}

async function api(method, url, body) {
    const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok && r.status !== 204) throw new Error(`${method} ${url}: HTTP ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
}

async function seed(lang, dataDir) {
    const L = T[lang];
    await api('POST', '/api/components/import', { rows: demoRows(L), existing: 'skip' });
    const comps = await api('GET', '/api/components');
    const byName = n => comps.find(c => c.name === n);
    // malo istorije
    const ne = byName('NE555P');
    for (const delta of [-2, 5, -1]) await api('POST', `/api/components/${ne.id}/adjust`, { location_id: ne.stock[0].location_id, delta });
    await api('PATCH', `/api/components/${ne.id}`, { notes: L.note });
    // "ključ" samo da bi pretraga koristila keš ispod (ne poziva internet)
    for (const s of await api('GET', '/api/services')) await api('PATCH', `/api/services/${s.id}`, { api_key: 'f3a9c1e2-7b4d-4e1a-9c2f-5d8e6b0a1c47', is_active: true });
    const db = new DatabaseSync(path.join(dataDir, 'inventory.db'));
    for (const src of ['mouser', 'element14']) {
        db.prepare('INSERT OR REPLACE INTO lookup_cache (cache_key, payload, created_at) VALUES (?, ?, ?)')
            .run(`${src}|begins|NE555P`, JSON.stringify(demoLookup(src)), Date.now());
    }
    db.close();
    // nešto u kanti
    const extra = await api('POST', '/api/components', { name: 'BC337', mpn: 'BC337-40', stock: [] });
    await api('DELETE', `/api/components/${extra.id}`);
    const loc = await api('POST', '/api/locations/ensure', { path: `${L.shelf} › ${lang === 'sr' ? 'Stara kutija' : 'Old box'}` });
    await api('DELETE', `/api/locations/${loc.id}`);
}

// ---------------------------------------------------------------------
// --real: kopija tvoje baze
// ---------------------------------------------------------------------
const FAKE_KEY = 'f3a9c1e2-7b4d-4e1a-9c2f-5d8e6b0a1c47';

function copyRealData(src, dataDir) {
    const db = new DatabaseSync(path.join(src, 'inventory.db'), { readOnly: true });
    db.exec(`VACUUM INTO '${path.join(dataDir, 'inventory.db').split(path.sep).join('/')}'`);
    db.close();
    for (const sub of ['images', 'datasheets']) {
        if (fs.existsSync(path.join(src, sub))) fs.cpSync(path.join(src, sub), path.join(dataDir, sub), { recursive: true });
    }
    const copy = new DatabaseSync(path.join(dataDir, 'inventory.db'));
    copy.prepare("UPDATE api_services SET api_key = ? WHERE api_key <> ''").run(FAKE_KEY);   // pravi ključevi ne idu na slike
    copy.prepare('UPDATE lookup_cache SET created_at = ?').run(Date.now());                   // sačuvane pretrage važe
    copy.close();
}

// Šta se prikazuje na slikama u --real režimu (bira se iz tvojih podataka)
async function realPlan() {
    const comps = await api('GET', '/api/components');
    const pick = comps.find(c => c.name === REAL_PICK) || comps.find(c => c.image_file) || comps[0];
    const count = key => {
        const m = new Map();
        for (const c of comps) for (const k of key(c)) if (k != null) m.set(k, (m.get(k) || 0) + 1);
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const topCat = count(c => [c.category_id])[0]?.[0];
    const locs = await api('GET', '/api/locations');
    const byLoc = count(c => c.stock.map(s => s.location_id));
    // za telefon: lokacija sa 4–10 komponenti (cela lista ne staje na ekran)
    const phoneLoc = (byLoc.find(([, n]) => n >= 4 && n <= 10) || byLoc[0])?.[0];
    const topLoc = byLoc[0]?.[0];
    const cats = await api('GET', '/api/categories');
    const catName = id => cats.find(c => c.id === id)?.name || '';
    const locPath = locs.find(l => l.id === topLoc)?.path || '';
    // nešto u kanti (samo u kopiji)
    const extra = await api('POST', '/api/components', { name: 'BC337', mpn: 'BC337-40', stock: [] });
    await api('DELETE', `/api/components/${extra.id}`);
    return {
        search: pick.mpn || pick.name, row: pick.name, lookup: REAL_LOOKUP,
        filters: `cat=${topCat}&loc=${topLoc}`, phone: `loc=${phoneLoc}`,
        csvRows: [
            `${pick.name};${pick.manufacturer || ''};${pick.package || ''};${catName(pick.category_id)};${locPath};5`,
            `TL431;Texas Instruments;TO-92;${catName(topCat)};${locPath};15`,
            `LM317T;STMicroelectronics;TO-220;${catName(topCat)};${locPath};6`,
            `CD4017BE;Texas Instruments;DIP-16;${catName(topCat)};${locPath};4`
        ]
    };
}

// ---------------------------------------------------------------------
// Minimalni DevTools (CDP) klijent – bez dodatnih paketa
// ---------------------------------------------------------------------
async function connect() {
    for (let i = 0; i < 50; i++) {
        try {
            const pages = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
            const page = pages.find(p => p.type === 'page');
            if (page) return openSocket(page.webSocketDebuggerUrl);
        } catch { /* još se pokreće */ }
        await sleep(200);
    }
    throw new Error('Browser se nije pokrenuo');
}

function openSocket(url) {
    const ws = new WebSocket(url);
    let id = 0;
    const waiting = new Map();
    ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        if (msg.id && waiting.has(msg.id)) {
            const { resolve, reject } = waiting.get(msg.id);
            waiting.delete(msg.id);
            msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const n = ++id;
        waiting.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
    });
    return new Promise(res => (ws.onopen = () => res({ send, close: () => ws.close() })));
}

function page(cdp) {
    const evaluate = async expr => {
        const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
        return r.result.value;
    };
    const waitFor = async (expr, ms = 8000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) { if (await evaluate(expr)) return; await sleep(150); }
        throw new Error('Nije se pojavilo: ' + expr);
    };
    return {
        evaluate, waitFor,
        size: (width, height, mobile = false) => cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }),
        goto: async url => {
            await cdp.send('Page.navigate', { url: BASE + url });
            await sleep(400);
            await waitFor(`document.readyState === 'complete' && !!document.querySelector('.main .page')`);
            await sleep(600);
        },
        // klik na element koji sadrži tekst (dugme, red tabele…)
        click: async (selector, text) => {
            const ok = await evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
                .find(e => ${text ? `e.innerText.trim().includes(${JSON.stringify(text)})` : 'true'} && e.offsetParent !== null);
                if (el) el.click(); return !!el; })()`);
            if (!ok) throw new Error(`Nema elementa: ${selector} "${text || ''}"`);
            await sleep(700);
        },
        shot: async file => {
            await evaluate(`document.activeElement?.blur()`);
            await sleep(300);
            const { data } = await cdp.send('Page.captureScreenshot', { format: 'webp', quality: 85 });
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, Buffer.from(data, 'base64'));
            console.log('  ✓', path.relative(ROOT, file));
        }
    };
}

// ---------------------------------------------------------------------
// Snimanje ekrana jednog jezika
// ---------------------------------------------------------------------
async function screens(lang) {
    const L = T[lang];
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-guide-'));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-guide-browser-'));
    const out = name => path.join(ROOT, 'client', 'public', 'guide-shots', lang, `${name}.webp`);
    if (REAL) copyRealData(REAL_DATA, dataDir);
    const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
        cwd: ROOT, env: { ...process.env, CT_DATA_DIR: dataDir, APP_PORT: String(PORT), OPEN_BROWSER: '' }, stdio: 'ignore'
    });
    const browser = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
        '--hide-scrollbars', '--no-first-run', '--disable-extensions', `--window-size=${VIEW.width},${VIEW.height}`, 'about:blank'], { stdio: 'ignore' });
    try {
        for (let i = 0; ; i++) {
            try { await fetch(BASE + '/api/system'); break; } catch { if (i > 50) throw new Error('Server se nije pokrenuo'); await sleep(200); }
        }
        let plan = null;
        if (REAL) plan = await realPlan();
        else await seed(lang, dataDir);
        const cdp = await connect();
        const p = page(cdp);
        await cdp.send('Page.enable');
        await p.size(VIEW.width, VIEW.height);
        await cdp.send('Page.navigate', { url: BASE + '/' });
        await sleep(800);
        await p.evaluate(`localStorage.setItem('locale', '${lang}'); localStorage.setItem('theme', 'light'); localStorage.setItem('textSize', 'normal'); localStorage.removeItem('componentsTable'); true`);

        const ids = await p.evaluate(`fetch('/api/locations').then(r => r.json()).then(l => l.map(x => [x.path, x.id]))`);
        const locId = n => ids.find(([pth]) => pth.endsWith(n))?.[1];
        const cats = await p.evaluate(`fetch('/api/categories').then(r => r.json()).then(c => c.map(x => [x.name, x.id]))`);
        const catId = n => cats.find(([nm]) => nm === n)?.[1];

        await p.goto('/'); await p.shot(out('dashboard'));
        await p.goto('/components'); await p.shot(out('components'));
        plan ||= {
            search: 'NE555', row: 'NE555P',
            filters: `cat=${catId(L.tr)}&loc=${locId(L.d2)}`, phone: `loc=${locId(L.d2)}`,
            csvRows: [`NE555P;Texas Instruments;DIP-8;${L.ic};${L.cab} › ${L.d1};10`,
                `TL431;Texas Instruments;TO-92;${L.reg};${L.cab} › ${L.d2};15`,
                `BC547B;onsemi;TO-92;${L.tr};${L.cab} › ${L.d2};25`,
                `CD4017BE;Texas Instruments;DIP-16;${L.ic};${L.cab} › ${L.d1};4`]
        };
        await p.goto(`/components?${plan.filters}`); await p.shot(out('filters'));

        await p.goto(`/components?q=${encodeURIComponent(plan.search)}`);
        await p.click('.p-datatable-tbody tr', plan.row);
        await p.waitFor(`!!document.querySelector('.cdrawer')`);
        await sleep(1500);   // slika komponente (može se učitavati sa interneta)
        await p.shot(out('component'));
        await p.click('.cdrawer .p-tab', lang === 'sr' ? 'Istorija' : 'History');
        await p.shot(out('history'));
        if (plan.lookup && plan.lookup !== plan.row) {
            await p.goto(`/components?q=${encodeURIComponent(plan.lookup)}`);
            await p.click('.p-datatable-tbody tr', plan.lookup);
            await p.waitFor(`!!document.querySelector('.cdrawer')`);
            await sleep(500);
        }
        await p.click('.cdrawer button', lang === 'sr' ? 'Pronađi online' : 'Find online');
        await p.waitFor(`document.querySelectorAll('.p-dialog .p-datatable-tbody tr').length > 1`);
        await sleep(500);
        await p.shot(out('lookup'));

        await p.goto('/locations'); await p.shot(out('locations'));
        await p.evaluate(`(() => { const b = [...document.querySelectorAll('.pi-qrcode')].map(i => i.closest('button')).filter(Boolean).pop(); b.click(); return true; })()`);
        await sleep(800);
        // primer adrese umesto prave adrese računara na kome se pravi slika
        await p.evaluate(`(() => { const i = document.querySelector('.p-dialog .p-select input'); i.value = 'http://192.168.1.10:3000';
            i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        await sleep(300);
        await p.shot(out('qr'));

        await p.goto('/components');
        await p.click('.toolbar button', lang === 'sr' ? 'Uvoz' : 'Import');
        const csv = [lang === 'sr' ? 'Naziv;Proizvođač;Kućište;Kategorija;Lokacija;Količina' : 'Name;Manufacturer;Package;Category;Location;Quantity',
            ...plan.csvRows].join('\r\n');
        await p.evaluate(`(() => { const input = document.querySelector('.p-dialog input[type=file]'); const dt = new DataTransfer();
            dt.items.add(new File([${JSON.stringify(csv)}], 'inventar.csv', { type: 'text/csv' })); input.files = dt.files;
            input.dispatchEvent(new Event('change')); return true; })()`);
        await p.waitFor(`document.querySelectorAll('.p-dialog .p-datatable-tbody tr').length > 1`);
        await sleep(600);
        await p.shot(out('import'));

        await p.goto('/trash'); await p.shot(out('trash'));
        await p.goto('/settings'); await p.shot(out('settings'));

        // telefon
        await p.size(390, 844, true);
        await p.goto(`/components?${plan.phone}`); await p.shot(out('phone'));
        cdp.close();
    } finally {
        browser.kill();
        server.kill();
        await sleep(800);
        for (const dir of [dataDir, profile]) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    }
}

const langs = process.argv.slice(2).filter(a => a === 'sr' || a === 'en');
for (const lang of (langs.length ? langs : ['sr', 'en'])) {
    console.log(`\n${lang}:`);
    await screens(lang);
}
