// *********************************************************************
// Zajednički pomoćni kod za sve dobavljače
// Svaki provider vraća kandidate u ISTOM obliku:
// { source, mpn, manufacturer, description, package, lifecycle,
//   stock, image_url, datasheet_url, product_url, params: [{name, value}] }
// *********************************************************************

export const normMpn = s => String(s || '').toUpperCase().replace(/[\s]/g, '');

// Sufiksi koji označavaju pakovanje / RoHS, a ne drugu komponentu.
// Heuristika: IRFZ44NPBF, IRFZ44NSTRLPBF i IRFZ44N završe u istoj "porodici",
// kao i TI varijante NE555DR / NE555DRG4 / NE555DRE4 → NE555D (isto kućište, drugo pakovanje).
const PACKAGING_SUFFIX = /(TRPBF|STRLPBF|STRRPBF|TRLPBF|#PBF|PBF|\/TR|-TR|-?T1|-?RL|-?REEL|-ND|-13|-7|-F|G4|E4|G3|E3)$/;
const REEL_LETTER = /(?<=[A-Z])[RT]$/;   // NE555DR → NE555D, NE555DT → NE555D

// minLen: porodica nikad ne postaje kraća od onoga što je korisnik ukucao
export function familyOf(mpn, minLen = 4) {
    let s = normMpn(mpn);
    for (let i = 0; i < 4; i++) {
        const next = s.replace(PACKAGING_SUFFIX, '');
        if (next === s || next.length < minLen) break;
        s = next;
    }
    const noReel = s.replace(REEL_LETTER, '');
    return noReel.length >= Math.max(minLen, 5) ? noReel : s;
}

// Prepoznavanje kućišta iz parametara ili opisa
const PACKAGE_RE = /\b(TO-?\d{2,3}[A-Z]{0,3}(-\d)?|SOT-?\d{2,3}(-\d)?|SOD-?\d{2,3}[A-Z]?|SOIC-?\d*|SO-?\d+|TSSOP-?\d*|MSOP-?\d*|[DV]?QFN-?\d*|QFP-?\d*|LQFP-?\d*|BGA-?\d*|DIP-?\d*|PDIP-?\d*|D2PAK|DPAK|PowerPAK[\w-]*|SMA|SMB|SMC|DO-?\d{2,3}[A-Z]{0,2}|0201|0402|0603|0805|1206|1210|2512|Radial|Axial)\b/i;

export function detectPackage(params, ...texts) {
    const p = params.find(x => /package|case|kućište/i.test(x.name) && !/packaging/i.test(x.name));
    if (p?.value) return p.value;
    for (const t of texts) {
        const m = String(t || '').match(PACKAGE_RE);
        if (m) return m[0].toUpperCase();
    }
    return null;
}

// Pretvara opis u čitljiv tekst (jedan parametar po redu) – kao u postojećoj aplikaciji
export const descriptionLines = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean).join('\n');
