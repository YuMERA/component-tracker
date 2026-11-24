// *********************************************************************
// installed.js – ulaz instaliranog programa (ComponentTracker.exe)
//
//   ComponentTracker.exe          → server (pokreće ga Windows servis)
//   ComponentTracker.exe --open   → ikonica: ako server radi, samo otvori
//                                   pregledač; ako ne radi, pokreni ga,
//                                   sačekaj da odgovori, pa otvori pregledač
//
// Po uzoru na Šank (src/ulaz.js + src/pokretac.js). U razvoju se ovaj fajl
// ne koristi – npm start / start_app.bat pokreću server/index.js direktno.
// *********************************************************************
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// .exe-u se ne može dati --disable-warning, pa se upozorenje
// "SQLite is an experimental feature" gasi ovde, pre učitavanja baze
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
    const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
    if (type === 'ExperimentalWarning' && /SQLite/i.test(String(warning))) return;
    return originalEmitWarning.call(process, warning, ...rest);
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Da li server na tom portu odgovara (bilo kakvim odgovorom) */
function isUp(url) {
    return new Promise(resolve => {
        const req = http.get(url, { timeout: 1500 }, res => { res.resume(); resolve(true); });
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.on('error', () => resolve(false));
    });
}

async function openApp() {
    const { config } = await import('./config.js');
    const url = `http://localhost:${config.port}/`;
    const openBrowser = () =>
        spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();

    try {
        if (!(await isUp(url))) {
            // servis ne radi (ugašen ili još nije krenuo) – isti .exe bez argumenata je server
            spawn(process.execPath, [], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
            let up = false;
            for (let i = 0; i < 60 && !up; i++) {          // do 30 s – prvi start pravi bazu
                await sleep(500);
                up = await isUp(url);
            }
            if (!up) throw new Error('Server se nije pokrenuo za 30 s / server did not start within 30 s');
        }
        openBrowser();
        process.exit(0);
    } catch (e) {
        // ikonica nema prozor – greška ide u dnevnik u folderu sa podacima
        try {
            fs.appendFileSync(path.join(config.dataDir, 'launcher.log'), `${new Date().toISOString()}  ${e.message}\n`);
        } catch { /* ni dnevnik ne može – nema više šta */ }
        process.exit(1);
    }
}

if (process.argv.includes('--open')) openApp();
else import('./index.js');
