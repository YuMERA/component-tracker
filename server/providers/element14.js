// *********************************************************************
// Element14 (Farnell) – vraća VIŠE kandidata
// *********************************************************************
import { detectPackage, descriptionLines } from './normalize.js';

const TERM_BY_MODE = {
    exact: q => `manuPartNum:${q}`,
    begins: q => `manuPartNum:${q}`,   // Element14 manuPartNum pretraga je već "počinje sa"
    keyword: q => `any:${q}`
};

export async function searchElement14(apiKey, q, mode, limit = 25) {
    const params = new URLSearchParams({
        term: TERM_BY_MODE[mode](q),
        'storeInfo.id': 'export.farnell.com',
        'resultsSettings.offset': '0',
        'resultsSettings.numberOfResults': String(limit),
        'resultsSettings.responseGroup': 'large',      // large = sa atributima (parametrima)
        'callInfo.responseDataFormat': 'json',
        'callInfo.apiKey': apiKey
    });

    const res = await fetch(`https://api.element14.com/catalog/products?${params}`);
    if (!res.ok) throw new Error(`Element14 HTTP ${res.status}`);
    const data = await res.json();

    const ret = data.manufacturerPartNumberSearchReturn || data.keywordSearchReturn || {};
    return (ret.products || []).map(p => {
        // displayName: "INFINEON - IRFZ44NPBF - Power MOSFET, N Channel, 55 V, ..."
        const parts = String(p.displayName || '').split(' - ');
        const description = parts.length >= 3 ? parts.slice(2).join(' - ') : p.displayName;
        // Atributi služe samo za prepoznavanje kućišta. Parametri se NE preuzimaju:
        // Element14 šalje brojeve bez jedinica, duplikate i carinske/RoHS podatke.
        const attrs = (p.attributes || []).map(a => ({ name: a.attributeLabel, value: a.attributeValue }));

        return {
            source: 'element14',
            mpn: p.translatedManufacturerPartNumber,
            manufacturer: p.brandName || p.vendorName || parts[0] || null,
            description: descriptionLines(description),
            package: detectPackage(attrs, description),
            lifecycle: p.productStatus === 'STOCKED' || p.productStatus === 'DIRECT_SHIP' ? 'Active'
                : p.productStatus === 'NO_LONGER_MANUFACTURED' ? 'Obsolete' : (p.productStatus || null),
            stock: p.stock?.level ?? null,
            image_url: p.image?.baseName ? `https://export.farnell.com/productimages/standard/en_GB${p.image.baseName}` : null,
            datasheet_url: p.datasheets?.[0]?.url || null,
            // pretraga po Farnell kataloškom broju vodi direktno na stranicu proizvoda
            product_url: p.sku ? `https://export.farnell.com/search?st=${encodeURIComponent(p.sku)}` : null
        };
    });
}
