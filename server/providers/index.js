// *********************************************************************
// Lookup orkestrator
// - pita SVE servise koji imaju ključ, paralelno
// - spaja iste delove iz različitih izvora (po MPN-u)
// - grupiše varijante u "porodice" (IRFZ44N / IRFZ44NPBF / IRFZ44NSTRLPBF)
// - označava šta već imaš u inventaru
// - kešira rezultate 24h u SQLite (štedi API kvotu)
// *********************************************************************
import { db } from '../db/index.js';
import { searchElement14 } from './element14.js';
import { searchMouser } from './mouser.js';
import { normMpn, familyOf } from './normalize.js';

const PROVIDERS = { element14: searchElement14, mouser: searchMouser };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cached(key, fn) {
    const row = db.prepare('SELECT payload, created_at FROM lookup_cache WHERE cache_key = ?').get(key);
    if (row && Date.now() - row.created_at < CACHE_TTL_MS) return Promise.resolve(JSON.parse(row.payload));
    return fn().then(result => {
        db.prepare('INSERT OR REPLACE INTO lookup_cache (cache_key, payload, created_at) VALUES (?, ?, ?)')
            .run(key, JSON.stringify(result), Date.now());
        return result;
    });
}

export const SUPPORTED = Object.keys(PROVIDERS);

// only: ograniči na jedan servis (dugme "Testiraj" u Podešavanjima), noCache: zaobiđi keš
export async function lookup(q, mode, { only = null, noCache = false } = {}) {
    const services = db.prepare("SELECT name, api_key FROM api_services WHERE is_active = 1 AND api_key <> ''").all()
        .filter(s => PROVIDERS[s.name] && (!only || s.name === only));
    if (!services.length) {
        return { query: q, mode, sources: [], candidates: [], message: 'No API service is enabled. Add an API key in Settings.' };
    }

    // Svi servisi paralelno; greška jednog ne ruši ostale
    const settled = await Promise.allSettled(services.map(s =>
        noCache
            ? PROVIDERS[s.name](s.api_key, q, mode)
            : cached(`${s.name}|${mode}|${q.toUpperCase()}`, () => PROVIDERS[s.name](s.api_key, q, mode))
    ));

    const sources = services.map((s, i) => ({
        name: s.name,
        ok: settled[i].status === 'fulfilled',
        count: settled[i].value?.length ?? 0,
        error: settled[i].reason?.message
    }));

    // Spajanje po MPN-u: isti deo kod Element14 i Mouser-a postaje jedan red
    const merged = new Map();
    for (const r of settled) {
        if (r.status !== 'fulfilled') continue;
        for (const c of r.value) {
            if (!c.mpn) continue;
            const key = normMpn(c.mpn);
            const prev = merged.get(key);
            if (!prev) {
                merged.set(key, { ...c, sources: [{ name: c.source, stock: c.stock, url: c.product_url }] });
                continue;
            }
            // isti izvor može imati više SKU-ova za isti deo (cut tape / reel) – sabiramo stanje
            const same = prev.sources.find(s => s.name === c.source);
            if (same) same.stock = (same.stock || 0) + (c.stock || 0);
            else prev.sources.push({ name: c.source, stock: c.stock, url: c.product_url });
            // popuni rupe podacima iz drugog izvora
            for (const f of ['manufacturer', 'description', 'package', 'image_url', 'datasheet_url', 'lifecycle', 'category']) {
                if (!prev[f] && c[f]) prev[f] = c[f];
            }
            if (c.params.length > prev.params.length) prev.params = c.params;
        }
    }

    // Šta već imamo u inventaru
    const inventory = new Map(db.prepare(`
        SELECT c.id, c.mpn, IFNULL(SUM(s.quantity), 0) AS quantity
        FROM components c LEFT JOIN stock s ON s.component_id = c.id
        WHERE c.mpn IS NOT NULL GROUP BY c.id`).all()
        .map(r => [normMpn(r.mpn), r]));

    const query = normMpn(q);
    const candidates = [...merged.values()].map(c => {
        const key = normMpn(c.mpn);
        delete c.source; delete c.stock; delete c.product_url;
        return {
            ...c,
            key,
            family: familyOf(c.mpn, query.length),
            exact: key === query,
            in_inventory: inventory.get(key) || null
        };
    });

    // Varijanta bez kućišta (npr. NE555DRG4) nasleđuje ga od porodice – ali samo ako
    // sve poznate varijante te porodice imaju ISTO kućište (inače ne nagađamo).
    const familyPackages = new Map();
    for (const c of candidates) if (c.package) {
        if (!familyPackages.has(c.family)) familyPackages.set(c.family, new Set());
        familyPackages.get(c.family).add(c.package);
    }
    for (const c of candidates) {
        const set = familyPackages.get(c.family);
        if (!c.package && set?.size === 1) { c.package = [...set][0]; c.package_inferred = true; }
    }

    // Porodica sa tačnim pogotkom prva, pa porodice koje počinju upitom, pa ostale.
    // Unutar porodice: tačan pogodak pa abecedno (redovi porodice moraju biti zajedno zbog grupisanja u tabeli).
    const exactFamilies = new Set(candidates.filter(c => c.exact).map(c => c.family));
    const rank = c => exactFamilies.has(c.family) ? 0 : c.key.startsWith(query) ? 1 : 2;
    const familyRank = new Map();
    for (const c of candidates) familyRank.set(c.family, Math.min(familyRank.get(c.family) ?? 9, rank(c)));
    candidates.sort((a, b) =>
        (familyRank.get(a.family) - familyRank.get(b.family)) ||
        a.family.localeCompare(b.family) ||
        (b.exact - a.exact) ||
        a.key.localeCompare(b.key));

    return { query: q, mode, sources, candidates };
}
