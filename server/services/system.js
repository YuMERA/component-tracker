// *********************************************************************
// Sistem: backup baze i provera ažuriranja
// *********************************************************************
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from '../db/index.js';
import { config } from '../config.js';

// ---------------------------------------------------------------------
// Backup – VACUUM INTO pravi konzistentnu kopiju i dok aplikacija radi
// ---------------------------------------------------------------------
export function listBackups() {
    return fs.readdirSync(config.backupsDir)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const st = fs.statSync(path.join(config.backupsDir, f));
            return { name: f, size: st.size, created_at: st.mtime.toISOString() };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function backupInfo() {
    return {
        db_size: fs.statSync(config.dbFile).size,
        folder: config.backupsDir,
        backups: listBackups()
    };
}

export function createBackup() {
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const name = `inventory-${stamp}.db`;
    const target = path.join(config.backupsDir, name).replace(/'/g, "''");
    db.exec(`VACUUM INTO '${target}'`);
    return name;
}

export function backupPath(name) {
    if (!/^[\w.-]+\.db$/.test(name)) return null;     // bez "../" i sličnog
    const p = path.join(config.backupsDir, name);
    return fs.existsSync(p) ? p : null;
}

export function deleteBackup(name) {
    const p = backupPath(name);
    if (p) fs.rmSync(p);
    return !!p;
}

// ---------------------------------------------------------------------
// Provera ažuriranja (version_info.json na GitHub-u)
// ---------------------------------------------------------------------
function semverGt(a, b) {
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
}

const updateState = { checked_at: null, latest: null, download_url: null, versions: [], error: null };

export async function checkForUpdates() {
    try {
        const get = withToken => fetch(config.versionUrl, {
            headers: {
                Accept: 'application/vnd.github.v3.raw',
                ...(withToken ? { Authorization: `Bearer ${config.githubToken}` } : {})
            },
            signal: AbortSignal.timeout(10000)
        });
        let res = await get(Boolean(config.githubToken));
        // istekao/pogrešan token: repo je javan, pa probaj bez tokena
        if (config.githubToken && (res.status === 401 || res.status === 403)) res = await get(false);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        Object.assign(updateState, {
            checked_at: new Date().toISOString(),
            latest: data.latest_version,
            download_url: data.download_url || null,
            versions: data.versions || [],
            error: null
        });
    } catch (e) {
        updateState.error = e.message;
        updateState.checked_at = new Date().toISOString();
    }
    return systemInfo();
}

// Adrese preko kojih se aplikacija vidi u lokalnoj mreži (za QR nalepnice i telefon)
function lanUrls() {
    const urls = [];
    for (const list of Object.values(os.networkInterfaces())) {
        for (const a of list || []) {
            if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${config.port}`);
        }
    }
    return urls;
}

export function systemInfo() {
    return {
        version: config.version,
        node: process.version,
        data_dir: config.dataDir,
        installed: config.installed,
        port: config.port,
        lan_urls: lanUrls(),
        update: {
            ...updateState,
            available: !!updateState.latest && semverGt(updateState.latest, config.version)
        }
    };
}
