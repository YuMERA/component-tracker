// *********************************************************************
// Element14 API vendor service
// Odgovoran ISKLJUČIVO za komunikaciju sa Element14 (Farnell) API-jem
// *********************************************************************

class Element14Service {
    constructor(config) {
        // config dolazi iz baze (api_services)
        this.apiKey = config.api_key;
    }

    /**
     * findPart
     * Traži komponentu po part number-u
     * @param {string} partNumber
     * @returns {object} standardizovan response za frontend
     */
    async findPart(partNumber) {
        if (!partNumber) {
            return { success: false, message: 'No Part Number provided' };
        }

        try {
            const apiUrl =
                `https://api.element14.com/catalog/products` +
                `?term=any:${encodeURIComponent(partNumber)}` +
                `&storeInfo.id=export.farnell.com` +
                `&resultsSettings.offset=0` +
                `&resultsSettings.numberOfResults=1` +
                `&resultsSettings.refinements.filters=inStock` +
                `&resultsSettings.responseGroup=mediuml` +
                `&callInfo.responseDataFormat=json` +
                `&callinfo.apiKey=${this.apiKey}`;

            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();
            const product = data.keywordSearchReturn?.products?.[0];

            if (!product) {
                return { success: false, message: 'Part not found' };
            }

            const displayName = product.displayName || '';
            
            // Nove promene: Parsiranje displayName-a po vašem zahtevu
            let componentName = '';
            let description = '';
            let formattedDescription = '';
            
            // Razdvojiti displayName po " - " (crtica sa razmacima)
            const parts = displayName.split(' - ');
            
            if (parts.length >= 3) {
                // Format: "INFINEON - IRFZ44NPBF - Power MOSFET, N Channel, 55 V, 41 A, 0.0175 ohm, TO-220AB, Through Hole"
                // componentName je drugi element (IRFZ44NPBF)
                componentName = parts[1].trim();
                
                // Description je sve nakon drugog " - "
                description = parts.slice(2).join(' - ').trim();
                
                // Formatiranje description-a sa novim redovima umesto zareza
                if (description) {
                    formattedDescription = description
                        .split(',')
                        .map(item => item.trim())
                        .filter(item => item.length > 0)
                        .join('\n');
                }
            } else {
                // Fallback na staru logiku ako format nije standardan
                const nameParts = displayName.split(',');
                const header = nameParts.shift()?.trim() || '';
                description = nameParts.join(',').trim();

                componentName = header;
                if (header.includes(' - ')) {
                    componentName = header.split(' - ').slice(1).join(' - ').trim();
                }
                
                // Formatiranje fallback description-a
                if (description) {
                    formattedDescription = description
                        .split(',')
                        .map(item => item.trim())
                        .filter(item => item.length > 0)
                        .join('\n');
                }
            }

            return {
                success: true,
                part_number: product.translatedManufacturerPartNumber,
                component_name: componentName,
                description: formattedDescription, // Sada formatiran sa novim redovima
                original_description: description, // Čuva original za svaki slučaj
                datasheet_url: product.datasheets?.[0]?.url || '',
                image_url: product.image
                    ? `https://export.farnell.com/productimages/standard/en_GB${product.image.baseName}`
                    : '',
                api_service: 'Find part use - Element14 API Service'
            };

        } catch (err) {
            console.error('Element14 API Error:', err.message);
            return { success: false, message: 'Error fetching data from Element14 API' };
        }
    }
}

module.exports = Element14Service;