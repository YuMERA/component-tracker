// *********************************************************************
// serviceResolver.js
// Odgovoran za izbor i instanciranje aktivnog API servisa
// *********************************************************************

const Element14Service = require('./vendors/element14');
const MouserService = require('./vendors/mouser');

async function resolveApiService(db) {
    // Čitamo aktivni servis iz baze
    const activeService = await db.get(
        'SELECT * FROM api_services WHERE is_active = 1'
    );

    if (!activeService) {
        throw new Error('No active API service configured');
    }

    switch (activeService.name) {
        case 'element14':
            return new Element14Service(activeService);

        case 'mouser':
            return new MouserService(activeService);

        default:
            throw new Error(`Unsupported API service: ${activeService.name}`);
    }
}

module.exports = { resolveApiService };
