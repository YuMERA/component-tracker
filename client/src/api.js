// *********************************************************************
// api.js – svi pozivi ka serveru na jednom mestu
// *********************************************************************
async function request(method, url, body) {
    const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

const get = url => request('GET', url);
const post = (url, body) => request('POST', url, body || {});
const patch = (url, body) => request('PATCH', url, body);
const del = url => request('DELETE', url);

export const api = {
    components: () => get('/api/components'),
    component: id => get(`/api/components/${id}`),
    movements: (limit = 20) => get(`/api/components/movements?limit=${limit}`),
    createComponent: data => post('/api/components', data),
    updateComponent: (id, data) => patch(`/api/components/${id}`, data),
    deleteComponent: id => del(`/api/components/${id}`),
    adjust: (id, body) => post(`/api/components/${id}/adjust`, body),
    move: (id, body) => post(`/api/components/${id}/move`, body),
    bulk: (ids, action, value) => post('/api/components/bulk', { ids, action, value }),
    cacheImage: id => post(`/api/components/${id}/cache-image`),
    cacheDatasheet: id => post(`/api/components/${id}/cache-datasheet`),

    categories: () => get('/api/categories'),
    createCategory: name => post('/api/categories', { name }),
    updateCategory: (id, name) => patch(`/api/categories/${id}`, { name }),
    deleteCategory: (id, moveTo) => del(`/api/categories/${id}${moveTo ? `?move_to=${moveTo}` : ''}`),

    locations: () => get('/api/locations'),
    ensureLocation: path => post('/api/locations/ensure', { path }),
    createLocation: data => post('/api/locations', data),
    updateLocation: (id, data) => patch(`/api/locations/${id}`, data),
    deleteLocation: id => del(`/api/locations/${id}`),

    lookup: (q, mode) => get(`/api/lookup?q=${encodeURIComponent(q)}&mode=${mode}`),
    services: () => get('/api/services'),
    updateService: (id, data) => patch(`/api/services/${id}`, data),
    testService: id => post(`/api/services/${id}/test`),
    setPrimaryService: id => post(`/api/services/${id}/primary`),
    clearLookupCache: () => del('/api/lookup-cache'),
    cacheAllImages: () => post('/api/files/cache-images'),

    backupInfo: () => get('/api/backup'),
    createBackup: () => post('/api/backup'),
    deleteBackup: name => del(`/api/backup/${encodeURIComponent(name)}`),

    system: () => get('/api/system'),
    checkUpdate: () => post('/api/system/check-update')
};
