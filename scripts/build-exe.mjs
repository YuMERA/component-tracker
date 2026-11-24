// *********************************************************************
// build-exe.mjs – pravi ComponentTracker.exe (bez potrebe za instaliranim Node-om)
//
//   npm run build:exe   →   release/ComponentTracker/  (ComponentTracker.exe + dist/)
//
// Koraci (isto kao Šank, alati/pakovanje/napravi-exe.js):
//   1. frontend (vite build → dist/)
//   2. sav serverski kod + express spoje se u JEDAN fajl (esbuild, CommonJS)
//   3. Node od tog fajla napravi "blob" (Single Executable Application)
//   4. kopija node.exe postane ComponentTracker.exe, a blob se ugradi u nju (postject)
//   5. pored se kopira dist/ (ekrani), koji .exe služi
//
// Node koji pokreće ovu skriptu je Node koji ide korisniku – mora biti ≥ 22.13.
// *********************************************************************
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'release');
const WORK = path.join(OUT, 'work');
const APP = path.join(OUT, 'ComponentTracker');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const step = s => console.log(`\n▶ ${s}`);

if (process.platform !== 'win32') {
    console.error('ComponentTracker.exe se pravi na Windows-u (kopira se node.exe sa ovog računara).');
    process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(APP, { recursive: true });

step('1/5 Frontend (vite build)');
execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });

step('2/5 Spajam serverski kod u jedan fajl (esbuild)');
const bundle = path.join(WORK, 'component-tracker.cjs');
await build({
    entryPoints: [path.join(ROOT, 'server', 'installed.js')],
    bundle: true,
    platform: 'node',
    target: `node${process.versions.node.split('.')[0]}`,
    format: 'cjs',
    outfile: bundle,
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    // import.meta.url se koristi samo kad NIJE .exe (config.js) – upozorenje je bezopasno
    logOverride: { 'empty-import-meta': 'silent' },
    logLevel: 'warning'
});

step('3/5 Pravim blob (node --experimental-sea-config)');
const blob = path.join(WORK, 'component-tracker.blob');
const seaConfig = path.join(WORK, 'sea-config.json');
fs.writeFileSync(seaConfig, JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true }, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

step('4/5 Ugrađujem blob u ComponentTracker.exe (postject)');
const exe = path.join(APP, 'ComponentTracker.exe');
fs.copyFileSync(process.execPath, exe);
execFileSync(process.execPath, [
    require.resolve('postject/dist/cli.js'), exe, 'NODE_SEA_BLOB', blob,
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
], { stdio: 'inherit' });

step('5/5 Kopiram ekrane (dist/)');
fs.cpSync(path.join(ROOT, 'dist'), path.join(APP, 'dist'), { recursive: true });
fs.rmSync(path.join(APP, 'dist', '.build-hash'), { force: true });

const mb = (fs.statSync(exe).size / 1024 / 1024).toFixed(1);
console.log(`\n✔ Gotovo: ${exe} (${mb} MB), verzija ${pkg.version}, Node ${process.version}`);
