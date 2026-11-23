// *********************************************************************
// prepare.mjs – priprema pre pokretanja (koriste je start_app.bat i start.sh)
//
// 1. proverava verziju Node.js
// 2. instalira pakete ako ih nema ili se package-lock.json promenio
// 3. pravi frontend ako ga nema ili se izvorni kod promenio (npr. posle ažuriranja)
//
// Svaki korak se preskače kad nije potreban, pa je svako sledeće pokretanje brzo.
// *********************************************************************
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_NODE = [22, 13];

function fail(message) {
    console.error(`\n[!] ${message}\n`);
    process.exit(1);
}

function run(args, label) {
    console.log(`\n> ${label}…`);
    const r = spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', shell: true });
    if (r.status !== 0) fail(`"npm ${args.join(' ')}" nije uspeo / failed.`);
}

const hash = h => h.digest('hex').slice(0, 16);

// Hash svih fajlova u folderu (rekurzivno) – menja se kad se promeni bilo koji fajl
function hashTree(h, dir) {
    for (const name of fs.readdirSync(dir).sort()) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) hashTree(h, p);
        else h.update(path.relative(ROOT, p)).update(fs.readFileSync(p));
    }
}

// --- 1. Node.js ------------------------------------------------------
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
    fail(`Potreban je Node.js ${MIN_NODE.join('.')} ili noviji (instaliran je ${process.versions.node}).\n` +
         `    Node.js ${MIN_NODE.join('.')}+ is required (installed: ${process.versions.node}).\n` +
         '    https://nodejs.org');
}

// --- 2. Paketi -------------------------------------------------------
const lockHash = () => {
    const f = fs.existsSync(path.join(ROOT, 'package-lock.json')) ? 'package-lock.json' : 'package.json';
    return hash(crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))));
};
const lockMarker = path.join(ROOT, 'node_modules', '.component-tracker-lock');

if (!fs.existsSync(lockMarker) || fs.readFileSync(lockMarker, 'utf8') !== lockHash()) {
    run(['install', '--no-audit', '--no-fund'], 'Instalacija paketa / Installing dependencies');
    fs.writeFileSync(lockMarker, lockHash());   // posle instalacije – npm ponekad sam izmeni lock fajl
}

// --- 3. Frontend -----------------------------------------------------
const srcHasher = crypto.createHash('sha1');
hashTree(srcHasher, path.join(ROOT, 'client'));
for (const f of ['vite.config.js', 'package.json']) srcHasher.update(fs.readFileSync(path.join(ROOT, f)));
const srcHash = hash(srcHasher);
const buildMarker = path.join(ROOT, 'dist', '.build-hash');

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html')) ||
    !fs.existsSync(buildMarker) || fs.readFileSync(buildMarker, 'utf8') !== srcHash) {
    run(['run', 'build'], 'Pravljenje frontenda / Building frontend');
    fs.writeFileSync(buildMarker, srcHash);
}

console.log('\n✓ Spremno / Ready\n');
