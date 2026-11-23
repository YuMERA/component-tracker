// *********************************************************************
// Mouser – part number pretraga (tačno / počinje sa) i keyword pretraga
// *********************************************************************
import { detectPackage, descriptionLines } from './normalize.js';

export async function searchMouser(apiKey, q, mode, limit = 25) {
    const isKeyword = mode === 'keyword';
    const url = `https://api.mouser.com/api/v1/search/${isKeyword ? 'keyword' : 'partnumber'}?apiKey=${encodeURIComponent(apiKey)}`;
    const body = isKeyword
        ? { SearchByKeywordRequest: { keyword: q, records: limit, startingRecord: 0, searchOptions: '' } }
        : { SearchByPartRequest: { mouserPartNumber: q, partSearchOptions: mode === 'exact' ? 'Exact' : 'None' } };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Mouser HTTP ${res.status}`);
    const data = await res.json();
    if (data.Errors?.length) throw new Error(`Mouser: ${data.Errors[0].Message}`);

    return (data.SearchResults?.Parts || []).slice(0, limit).map(p => {
        // atributi samo za prepoznavanje kućišta – parametri se ne preuzimaju
        const attrs = (p.ProductAttributes || []).map(a => ({ name: a.AttributeName, value: a.AttributeValue }));

        return {
            source: 'mouser',
            mpn: p.ManufacturerPartNumber || p.MouserPartNumber,
            manufacturer: p.Manufacturer || null,
            description: descriptionLines(p.Description),
            package: detectPackage(attrs, p.Description),
            lifecycle: p.LifecycleStatus || (p.IsDiscontinued === 'true' ? 'Obsolete' : 'Active'),
            stock: parseInt(String(p.AvailabilityInStock ?? p.Availability ?? '').replace(/\D/g, ''), 10) || 0,
            image_url: p.ImagePath || null,
            datasheet_url: p.DataSheetUrl || null,
            product_url: p.ProductDetailUrl || null,
            category: p.Category || null
        };
    });
}
