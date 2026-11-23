// *********************************************************************
// Component Tracker v3 – server
// JSON REST API + statički Vue frontend (dist/) + lokalni fajlovi (data/)
// *********************************************************************
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from './config.js';
import './db/index.js';
import components from './routes/components.js';
import catalog from './routes/catalog.js';
import system from './routes/system.js';
import { checkForUpdates } from './services/system.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.use('/api/components', components);
app.use('/api', catalog);
app.use('/api', system);
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Lokalne kopije slika i datasheet-ova
app.use('/files/images', express.static(config.imagesDir, { maxAge: '7d' }));
app.use('/files/datasheets', express.static(config.datasheetsDir));

// Frontend (posle `npm run build`)
if (fs.existsSync(config.distDir)) {
    app.use(express.static(config.distDir));
    app.get(/^\/(?!api|files).*/, (req, res) => res.sendFile(path.join(config.distDir, 'index.html')));
} else {
    app.get('/', (req, res) => res.type('text').send('Frontend is not built. Run "npm run build" (or "npm run dev" for development).'));
}

// Greške: HttpError nosi status, sve ostalo je 500
app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ message: err.message || 'Server error', ...(err.extra || {}) });
});

const url = `http://localhost:${config.port}`;

// start_app.bat / start.sh postavljaju OPEN_BROWSER=1 – browser se otvara tek kad je server spreman
function openBrowser() {
    if (!process.env.OPEN_BROWSER) return;
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

const server = app.listen(config.port, () => {
    console.log(`Component Tracker v${config.version} → ${url}`);
    console.log(`© ${new Date().getFullYear()} mera-system · https://mera-system.com`);
    console.log('Za zaustavljanje zatvori ovaj prozor ili pritisni Ctrl+C / To stop, close this window or press Ctrl+C');
    openBrowser();
    checkForUpdates();
});

server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[!] Port ${config.port} je zauzet – aplikacija verovatno već radi. / Port ${config.port} is in use – the app is probably already running.`);
        console.error(`    Otvori / Open: ${url}  (drugi port: APP_PORT u .env / another port: APP_PORT in .env)\n`);
        openBrowser();
        process.exit(1);
    }
    throw err;
});
