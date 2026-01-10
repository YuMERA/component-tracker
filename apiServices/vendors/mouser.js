// *********************************************************************
// Mouser API vendor service
// Odgovoran ISKLJUČIVO za komunikaciju sa Mouser Search API-jem
// *********************************************************************

class MouserService {
    constructor(config) {
        this.apiKey = config.api_key;
        this.baseUrl = 'https://api.mouser.com/api/v1/search/partnumber';

        // opciono, ali korisno za kasnije
        this.searchOptions = {
            ExactMatch: true
        };
    }

    /**
     * Formatira description tako da svaki element bude u novom redu
     * Specifično za Mouser format: 'Bipolar Transistors - BJT BJT, TO-92, 65V, 100mA, NPN'
     * @param {string} description
     * @returns {string} formatirani description
     */
    formatDescription(description) {
        if (!description || typeof description !== 'string') {
            return '';
        }
        
        // Pošto Mouser koristi zareze kao glavni separator, delimo po zarezima
        const parts = description.split(',');
        
        // Čistimo svaki deo i uklanjamo prazne
        const cleanedParts = parts
            .map(part => part.trim())
            .filter(part => part.length > 0);
        
        // Spajamo sa novim redovima
        return cleanedParts.join('\n');
    }

    /**
     * findPart
     * @param {string} partNumber
     * @returns {object} standardizovan response
     */
    async findPart(partNumber) {
        if (!partNumber) {
            return { success: false, message: 'No Part Number provided' };
        }

        try {
            const response = await fetch(
                `${this.baseUrl}?apiKey=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        SearchByPartRequest: {
                            mouserPartNumber: partNumber,
                            ...this.searchOptions
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Mouser API HTTP ${response.status}`);
            }

            const data = await response.json();

            const parts = data?.SearchResults?.Parts;

            if (!parts || parts.length === 0) {
                return { success: false, message: 'Part not found' };
            }

            const part = parts[0];
            
            // Formatiraj description
            const originalDescription = part.Description || '';
            const formattedDescription = this.formatDescription(originalDescription);

            return {
                success: true,
                part_number: part.ManufacturerPartNumber || part.MouserPartNumber || '',
                component_name: part.ManufacturerPartNumber || '',
                description: formattedDescription, // Formatirani opis sa novim redovima
                original_description: originalDescription, // Original za debug
                datasheet_url: part.DataSheetUrl || '',
                image_url: part.ImagePath || '',
                api_service: 'Find part use - Mouser API Service'
            };

        } catch (err) {
            console.error('Mouser API Error:', err.message);
            return { success: false, message: 'Error fetching data from Mouser API' };
        }
    }
}

module.exports = MouserService;