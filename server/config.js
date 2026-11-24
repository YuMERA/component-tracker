// *********************************************************************
// config.js – putanje i podešavanja na jednom mestu
//
// Dva načina rada:
//   - iz izvornog koda (npm start / start_app.bat): sve je u folderu projekta,
//     podaci u <projekat>/data
//   - instaliran program (ComponentTracker.exe iz setup-a): program je u
//     Program Files (samo za čitanje), podaci u C:\ProgramData\ComponentTracker
// Folder sa podacima se može zadati i promenljivom CT_DATA_DIR.
// *********************************************************************
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isSea } from 'node:sea';

/** true kad radi kao jedan .exe (Node SEA), tj. instaliran program */
export const INSTALLED = isSea();

export const ROOT = INSTALLED
    ? path.dirname(process.execPath)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DATA_DIR = process.env.CT_DATA_DIR
    ? path.resolve(process.env.CT_DATA_DIR)
    : INSTALLED
        ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'ComponentTracker')
        : path.join(ROOT, 'data');

// .env je opcion (APP_PORT, VERSION_URL, GITHUB_TOKEN). Instaliran program ga
// traži u folderu sa podacima – tamo preživljava i nadogradnju.
try { process.loadEnvFile(path.join(INSTALLED ? DATA_DIR : ROOT, '.env')); } catch { /* nema .env – u redu */ }

// Verzija: instaliran program je dobija ugrađenu pri pravljenju (scripts/build-exe.mjs)
/* global __APP_VERSION__ */
const version = typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

export const config = {
    version,
    installed: INSTALLED,
    // APP_PORT a ne PORT: alati za razvoj često sami postavljaju PORT za frontend
    port: Number(process.env.APP_PORT) || 3000,
    dataDir: DATA_DIR,
    dbFile: path.join(DATA_DIR, 'inventory.db'),
    imagesDir: path.join(DATA_DIR, 'images'),
    datasheetsDir: path.join(DATA_DIR, 'datasheets'),
    backupsDir: path.join(DATA_DIR, 'backups'),
    distDir: path.join(ROOT, 'dist'),
    versionUrl: process.env.VERSION_URL || 'https://raw.githubusercontent.com/YuMERA/component-tracker/main/version_info.json',
    githubToken: process.env.GITHUB_TOKEN || null
};

for (const dir of [config.dataDir, config.imagesDir, config.datasheetsDir, config.backupsDir]) {
    fs.mkdirSync(dir, { recursive: true });
}
