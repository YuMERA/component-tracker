// Izvoz trenutno prikazane (filtrirane ili selektovane) liste – radi u browseru
function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const locations = c => c.stock.map(s => `${s.location || '-'}: ${s.quantity}`).join('; ');

export function exportCsv(rows, t) {
    const cols = [
        [t('fields.name'), c => c.name],
        [t('fields.mpn'), c => c.mpn],
        [t('fields.manufacturer'), c => c.manufacturer],
        [t('fields.package'), c => c.package],
        [t('fields.category'), c => c.category],
        [t('fields.quantity'), c => c.quantity],
        [t('fields.min_stock'), c => c.min_stock],
        [t('fields.location'), locations],
        [t('fields.description'), c => (c.description || '').replace(/\n/g, ', ')],
        [t('fields.datasheet'), c => c.datasheet_url]
    ];
    const esc = v => {
        const s = v == null ? '' : String(v);
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map(c => esc(c[0])).join(','), ...rows.map(r => cols.map(c => esc(c[1](r))).join(','))];
    // BOM da Excel ispravno prikaže č, ć, š, ž, Ω…
    download(`components-${stamp()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

export function exportTxt(rows, t) {
    const lines = [`Component Tracker – ${stamp()} – ${rows.length}`, ''];
    for (const c of rows) {
        lines.push(`${c.name}${c.mpn && c.mpn !== c.name ? ` (${c.mpn})` : ''} – ${c.quantity} ${t('common.pcs')}`);
        const meta = [c.manufacturer, c.package, c.category, locations(c)].filter(Boolean).join(' | ');
        if (meta) lines.push(`    ${meta}`);
    }
    download(`components-${stamp()}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8');
}
