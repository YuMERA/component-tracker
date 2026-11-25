// *********************************************************************
// store.js – zajedničko stanje aplikacije (bez dodatnih biblioteka)
// Svaki ekran čita iz istog store-a, pa se izmena odmah vidi svuda.
// *********************************************************************
import { reactive } from 'vue';
import ToastEventBus from 'primevue/toasteventbus';
import { api } from './api.js';

export const store = reactive({
    components: [],
    categories: [],
    locations: [],
    loading: false,
    loaded: false,
    trashCount: 0,
    // bočni panel komponente – dostupan sa svakog ekrana
    drawer: { visible: false, id: null, prefill: null }
});

export async function loadAll() {
    store.loading = true;
    try {
        [store.components, store.categories, store.locations] =
            await Promise.all([api.components(), api.categories(), api.locations()]);
        store.loaded = true;
    } finally {
        store.loading = false;
    }
}

export async function refreshTrashCount() {
    try { store.trashCount = (await api.trashCount()).count; } catch { /* nije bitno za rad */ }
}

// Posle brisanja: poruka sa dugmetom "Poništi" (App.vue, Toast group="undo")
export function notifyTrashed(summary, trashIds) {
    refreshTrashCount();
    ToastEventBus.emit('add', { severity: 'info', summary, group: 'undo', life: 8000, data: { trashIds } });
}

export async function reloadCatalog() {
    [store.categories, store.locations] = await Promise.all([api.categories(), api.locations()]);
}

// Zameni (ili dodaj) jednu komponentu u listi posle izmene
export function putComponent(c) {
    const i = store.components.findIndex(x => x.id === c.id);
    if (i >= 0) store.components[i] = c;
    else store.components.push(c);
}

export function dropComponents(ids) {
    const set = new Set(ids);
    store.components = store.components.filter(c => !set.has(c.id));
}

export const openComponent = id => Object.assign(store.drawer, { visible: true, id });
export const openNewComponent = () => Object.assign(store.drawer, { visible: true, id: null });

// ---------------------------------------------------------------------
// Pomoćne funkcije koje koristi više ekrana
// ---------------------------------------------------------------------
export function stockStatus(c) {
    if (c.quantity <= 0) return { key: 'out', severity: 'danger' };
    if (c.min_stock > 0 && c.quantity <= c.min_stock) return { key: 'low', severity: 'warn' };
    return { key: 'ok', severity: 'success' };
}

export const imageSrc = c => (c?.image_file ? `/files/images/${c.image_file}` : c?.image_url || null);
export const datasheetHref = c => (c?.datasheet_file ? `/files/datasheets/${c.datasheet_file}` : c?.datasheet_url || null);

// Sve podlokacije date lokacije (uključujući nju)
export function locationWithChildren(id) {
    const ids = new Set([id]);
    let added = true;
    while (added) {
        added = false;
        for (const l of store.locations) {
            if (l.parent_id && ids.has(l.parent_id) && !ids.has(l.id)) { ids.add(l.id); added = true; }
        }
    }
    return ids;
}
