// *********************************************************************
// build-setup.mjs – pravi release/ComponentTracker-setup-<verzija>.exe
//
//   npm run build:setup
//
// Prvo napravi ComponentTracker.exe (build-exe.mjs), pa ga Inno Setup spakuje
// sa servisom i ikonicama (installer/component-tracker.iss). Verzija iz package.json.
//
// Treba Inno Setup 6. Traži se na uobičajenim mestima, a može se zadati i
// promenljivom ISCC (puna putanja do ISCC.exe).
// *********************************************************************
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const iscc = [
    process.env.ISCC,
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno', 'ISCC.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe'
].filter(Boolean).find(p => fs.existsSync(p));

if (!iscc) {
    console.error('Nema Inno Setup-a (ISCC.exe). Instaliraj Inno Setup 6 ili zadaj ISCC=<putanja>.');
    process.exit(1);
}

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-exe.mjs')], { stdio: 'inherit' });

console.log(`\n▶ Pravim setup ${pkg.version} (Inno Setup)`);
execFileSync(iscc, ['/Q', `/DAppVer=${pkg.version}`, path.join(ROOT, 'installer', 'component-tracker.iss')], { stdio: 'inherit' });

const setup = path.join(ROOT, 'release', `ComponentTracker-setup-${pkg.version}.exe`);
const mb = (fs.statSync(setup).size / 1024 / 1024).toFixed(1);
console.log(`\n✔ Gotovo: ${setup} (${mb} MB)`);
