// *********************************************************************
// Čitanje CSV fajla za uvoz – bez dodatnih biblioteka
// - Excel na srpskom Windows-u snima sa ";" i u kodnoj strani 1250,
//   a na engleskom sa "," u UTF-8 – oba se prepoznaju sama
// *********************************************************************

/** Tekst fajla: UTF-8 ako je ispravan, inače Windows-1250 (č, ć, š, ž iz starijeg Excel-a) */
export async function readText(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch { return new TextDecoder('windows-1250').decode(buf); }
}

/** Razdvajač: onaj koji se najčešće javlja u prvom redu (van navodnika) */
function detectDelimiter(text) {
    const first = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '');
    return [';', ',', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
}

/** CSV → niz redova (svaki red je niz ćelija); podržava navodnike i nove redove u ćeliji */
export function parseCsv(text) {
    const d = detectDelimiter(text);
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === d) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim()));
}

// Prepoznavanje kolona po nazivu zaglavlja (srpski, engleski, izvoz iz ove aplikacije, Mouser/Farnell korpe)
const ALIASES = {
    name: ['naziv', 'name', 'komponenta', 'component', 'ime', 'part', 'deo', 'vrednost', 'value'],
    mpn: ['mpn', 'part number (mpn)', 'part number', 'partnumber', 'mfr part number', 'mfr. part #', 'manufacturer part number', 'mfr. #', 'mfr #', 'mfr part #', 'p/n', 'pn', 'oznaka'],
    manufacturer: ['proizvođač', 'proizvodjac', 'manufacturer', 'mfr', 'brand'],
    package: ['kućište', 'kuciste', 'package', 'case', 'footprint', 'pakovanje'],
    category: ['kategorija', 'category', 'tip', 'type', 'grupa', 'group'],
    location: ['lokacija', 'location', 'mesto', 'kutija', 'box', 'fioka', 'drawer'],
    quantity: ['količina', 'kolicina', 'quantity', 'qty', 'qty.', 'order qty.', 'kom', 'komada', 'stanje', 'stock', 'pcs'],
    min_stock: ['minimalno stanje', 'minimum', 'min', 'min stock', 'min_stock', 'minimum stock'],
    description: ['opis', 'description', 'desc', 'napomena'],
    datasheet_url: ['datasheet', 'datasheet url', 'datasheet_url', 'pdf']
};
export const IMPORT_FIELDS = Object.keys(ALIASES);

/** Za svako polje indeks kolone u fajlu (ili null) */
export function guessMapping(header) {
    const norm = header.map(h => h.trim().toLowerCase());
    const used = new Set(), map = Object.fromEntries(IMPORT_FIELDS.map(f => [f, null]));
    // prvo tačni nazivi za sva polja, pa tek onda delimični ('Part number' ne sme da odnese 'Naziv')
    const pass = test => {
        for (const f of IMPORT_FIELDS) {
            if (map[f] != null) continue;
            const i = norm.findIndex((h, k) => !used.has(k) && test(h, f));
            if (i >= 0) { map[f] = i; used.add(i); }
        }
    };
    pass((h, f) => ALIASES[f].includes(h));
    pass((h, f) => ALIASES[f].some(a => a.length > 3 && h.includes(a)));
    return map;
}
