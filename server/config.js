// *********************************************************************
// config.js – putanje i podešavanja na jednom mestu
// *********************************************************************
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env je opcion (VERSION_URL, GITHUB_TOKEN, APP_PORT)
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* nema .env – u redu */ }

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

export const config = {
    version: pkg.version,
    // APP_PORT a ne PORT: alati za razvoj često sami postavljaju PORT za frontend
    port: Number(process.env.APP_PORT) || 3000,
    dataDir: path.join(ROOT, 'data'),
    dbFile: path.join(ROOT, 'data', 'inventory.db'),
    legacyDbFile: path.join(ROOT, 'inventory.db'),       // baza iz v2 (EJS) verzije
    imagesDir: path.join(ROOT, 'data', 'images'),
    datasheetsDir: path.join(ROOT, 'data', 'datasheets'),
    backupsDir: path.join(ROOT, 'data', 'backups'),
    distDir: path.join(ROOT, 'dist'),
    versionUrl: process.env.VERSION_URL || 'https://raw.githubusercontent.com/YuMERA/component-tracker/main/version_info.json',
    githubToken: process.env.GITHUB_TOKEN || null
};

for (const dir of [config.dataDir, config.imagesDir, config.datasheetsDir, config.backupsDir]) {
    fs.mkdirSync(dir, { recursive: true });
}
