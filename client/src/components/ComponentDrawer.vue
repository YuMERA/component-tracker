<script setup>
// *********************************************************************
// Bočni panel komponente: pregled, izmena, nova komponenta.
// Tab "Podaci" staje u jedan pogled; slika, parametri i istorija su u svojim tabovima.
// *********************************************************************
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Drawer from 'primevue/drawer';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import AutoComplete from 'primevue/autocomplete';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import Image from 'primevue/image';
import StockEditor from './StockEditor.vue';
import LookupDialog from './LookupDialog.vue';
import { api } from '../api.js';
import { store, putComponent, dropComponents, reloadCatalog, notifyTrashed, openComponent, stockStatus, imageSrc, datasheetHref } from '../store.js';

const { t, d } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const EMPTY = () => ({
    name: '', mpn: '', manufacturer: '', package: '', category: null, min_stock: 0,
    description: '', notes: '', image_url: '', datasheet_url: '', params: [],
    stock: [{ location: null, quantity: 0 }]
});

const form = ref(EMPTY());
const saved = ref(null);          // komponenta kako je na serveru (za lokalne fajlove, istoriju)
const original = ref('');
const movements = ref([]);
const tab = ref('data');
const saving = ref(false);
const duplicate = ref(null);
const lookupOpen = ref(false);
const imageFailed = ref(false);
const cachingDatasheet = ref(false);
const cachingImage = ref(false);

const isNew = computed(() => !store.drawer.id);
const dirty = computed(() => JSON.stringify(form.value) !== original.value);
const totalQty = computed(() => form.value.stock.reduce((s, r) => s + (r.quantity || 0), 0));
const status = computed(() => stockStatus({ quantity: totalQty.value, min_stock: form.value.min_stock }));

function toForm(c) {
    return {
        name: c.name || '', mpn: c.mpn || '', manufacturer: c.manufacturer || '', package: c.package || '',
        category: c.category || null, min_stock: c.min_stock || 0,
        description: c.description || '', notes: c.notes || '',
        image_url: c.image_url || '', datasheet_url: c.datasheet_url || '',
        params: (c.params || []).map(p => ({ ...p })),
        stock: c.stock.length ? c.stock.map(s => ({ location: s.location, quantity: s.quantity })) : [{ location: null, quantity: 0 }]
    };
}

async function load() {
    tab.value = 'data';
    duplicate.value = null;
    movements.value = [];
    imageFailed.value = false;
    if (isNew.value) {
        saved.value = null;
        // "Kopiraj kao novu": forma počinje od kopije, a ostaje "nesačuvana" dok se ne doda
        form.value = store.drawer.prefill ? { ...EMPTY(), ...store.drawer.prefill } : EMPTY();
        store.drawer.prefill = null;
        original.value = JSON.stringify(EMPTY());
        return;
    } else {
        const c = await api.component(store.drawer.id);
        saved.value = c;
        movements.value = c.movements;
        form.value = toForm(c);
    }
    original.value = JSON.stringify(form.value);
}

watch(() => [store.drawer.visible, store.drawer.id], ([open]) => { if (open) load(); });
watch(() => form.value.image_url, () => (imageFailed.value = false));

// Nova komponenta na osnovu ove (npr. drugi otpornik iste serije): sve osim MPN-a,
// a na istim lokacijama sa 0 komada
function copyAsNew() {
    const c = JSON.parse(JSON.stringify(form.value));
    c.mpn = '';
    c.stock = c.stock.map(r => ({ location: r.location, quantity: 0 }));
    Object.assign(store.drawer, { id: null, prefill: c });
    toast.add({ severity: 'info', summary: t('drawer.copied', { name: form.value.name }), life: 3000 });
}

// Zatvaranje taba / pregledača sa nesačuvanim izmenama – pregledač sam pita "Napusti stranicu?"
function onBeforeUnload(e) {
    if (store.drawer.visible && dirty.value) { e.preventDefault(); e.returnValue = ''; }
}
// Ctrl+S (Cmd+S na Mac-u) čuva otvorenu komponentu umesto da pregledač snima stranicu
function onKeydown(e) {
    if (!store.drawer.visible || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
    e.preventDefault();
    if (!lookupOpen.value && !saving.value && (isNew.value || dirty.value)) save();
}
onMounted(() => { window.addEventListener('beforeunload', onBeforeUnload); window.addEventListener('keydown', onKeydown); });
onBeforeUnmount(() => { window.removeEventListener('beforeunload', onBeforeUnload); window.removeEventListener('keydown', onKeydown); });

// Zatvaranje sa nesačuvanim izmenama traži potvrdu
const visible = computed({
    get: () => store.drawer.visible,
    set: v => {
        if (v || !dirty.value) { store.drawer.visible = v; return; }
        confirm.require({
            header: t('drawer.unsaved_title'),
            message: t('drawer.unsaved_message'),
            icon: 'pi pi-exclamation-triangle',
            acceptProps: { label: t('drawer.discard'), severity: 'danger' },
            rejectProps: { label: t('drawer.keep_editing'), severity: 'secondary', outlined: true },
            accept: () => (store.drawer.visible = false)
        });
    }
});

// ---------------------------------------------------------------------
// Snimanje
// ---------------------------------------------------------------------
async function resolvePayload() {
    const f = form.value;
    let category_id = null;
    if (f.category?.trim()) {
        const known = store.categories.find(c => c.name.toLowerCase() === f.category.trim().toLowerCase());
        category_id = known ? known.id : (await api.createCategory(f.category.trim())).id;
    }
    const stock = [];
    for (const r of f.stock) {
        let location_id = null;
        if (r.location?.trim()) {
            const known = store.locations.find(l => l.path.toLowerCase() === r.location.trim().toLowerCase());
            location_id = known ? known.id : (await api.ensureLocation(r.location.trim())).id;
        }
        stock.push({ location_id, quantity: r.quantity || 0 });
    }
    return {
        name: f.name, mpn: f.mpn, manufacturer: f.manufacturer, package: f.package, category_id,
        min_stock: f.min_stock, description: f.description, notes: f.notes,
        image_url: f.image_url, datasheet_url: f.datasheet_url,
        params: f.params.filter(p => p.name?.trim()), stock
    };
}

async function save(force = false) {
    if (!form.value.name.trim()) {
        toast.add({ severity: 'warn', summary: t('drawer.name_required'), life: 3000 });
        return;
    }
    saving.value = true;
    duplicate.value = null;
    try {
        const payload = await resolvePayload();
        const c = isNew.value
            ? await api.createComponent({ ...payload, force })
            : await api.updateComponent(store.drawer.id, payload);
        putComponent(c);
        await reloadCatalog();
        toast.add({ severity: 'success', summary: isNew.value ? t('drawer.added') : t('drawer.saved'), life: 2500 });
        if (isNew.value) {
            original.value = JSON.stringify(form.value);   // da ne pita za nesačuvane izmene
            openComponent(c.id);
        } else {
            await load();
        }
    } catch (e) {
        if (e.status === 409 && e.data.existing) duplicate.value = e.data.existing;
        else toast.add({ severity: 'error', summary: t('drawer.not_saved'), detail: e.message, life: 5000 });
    } finally {
        saving.value = false;
    }
}

// Duplikat: dodaj količinu postojećoj komponenti umesto nove
async function addToExisting() {
    const ex = duplicate.value;
    const payload = await resolvePayload();
    const first = payload.stock[0];
    const c = await api.adjust(ex.id, { location_id: first.location_id, delta: totalQty.value });
    putComponent(c);
    toast.add({ severity: 'success', summary: t('drawer.added_to_existing', { n: totalQty.value }), detail: `${c.name}: ${c.quantity}`, life: 3000 });
    original.value = JSON.stringify(form.value);
    openComponent(ex.id);
}

function remove() {
    confirm.require({
        header: t('common.delete'),
        message: t('drawer.delete_confirm', { name: form.value.name }),
        icon: 'pi pi-exclamation-triangle',
        acceptProps: { label: t('common.delete'), severity: 'danger' },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: async () => {
            const r = await api.deleteComponent(store.drawer.id);
            dropComponents([store.drawer.id]);
            await reloadCatalog();
            notifyTrashed(t('trash.moved_one', { name: form.value.name }), r.trash);
            original.value = JSON.stringify(form.value);
            store.drawer.visible = false;
        }
    });
}

// ---------------------------------------------------------------------
// Lookup, lokalni fajlovi, parametri
// ---------------------------------------------------------------------
function applyLookup(fields) {
    Object.assign(form.value, fields);
    toast.add({ severity: 'info', summary: t('lookup.applied'), detail: t('lookup.applied_hint'), life: 2500 });
}

async function cacheFile(kind) {
    const flag = kind === 'image' ? cachingImage : cachingDatasheet;
    flag.value = true;
    try {
        const c = kind === 'image' ? await api.cacheImage(store.drawer.id) : await api.cacheDatasheet(store.drawer.id);
        saved.value = { ...saved.value, image_file: c.image_file, datasheet_file: c.datasheet_file };
        putComponent(c);
        toast.add({ severity: 'success', summary: t('files.cached'), life: 2500 });
    } catch (e) {
        toast.add({ severity: 'error', summary: t('files.cache_failed'), detail: e.message, life: 6000 });
    } finally {
        flag.value = false;
    }
}

// Slika: lokalna kopija ako URL nije menjan u formi, inače novi URL
const previewSrc = computed(() =>
    saved.value && form.value.image_url === (saved.value.image_url || '') ? imageSrc(saved.value) : form.value.image_url);
const datasheetLink = computed(() =>
    saved.value && form.value.datasheet_url === (saved.value.datasheet_url || '') ? datasheetHref(saved.value) : form.value.datasheet_url);
const urlUnchanged = key => saved.value && form.value[key] === (saved.value[key] || '');

const categorySuggestions = ref([]);
const searchCategory = e => {
    const q = (e.query || '').toLowerCase();
    categorySuggestions.value = store.categories.map(c => c.name).filter(n => n.toLowerCase().includes(q));
};

const addParam = () => form.value.params.push({ name: '', value: '' });
const formatDate = s => d(new Date(s.replace(' ', 'T') + 'Z'), 'short');
const lookupQuery = computed(() => form.value.mpn || form.value.name);
</script>

<template>
    <Drawer v-model:visible="visible" position="right" :style="{ width: 'min(46rem, 100vw)' }" blockScroll class="cdrawer">
        <template #header>
            <!-- autofocus: Drawer inače pri otvaranju fokusira dugme X (prsten oko njega) -->
            <div class="row grow head" tabindex="-1" autofocus>
                <div class="thumb big" :class="{ clickable: previewSrc }" @click="previewSrc && (tab = 'photo')"
                     v-tooltip.bottom="previewSrc ? t('drawer.show_photo') : null">
                    <img v-if="previewSrc && !imageFailed" :src="previewSrc" alt="" />
                    <i v-else class="pi pi-microchip" style="font-size:1.4rem" />
                </div>
                <div class="grow">
                    <div class="title ellipsis">{{ isNew ? t('components.new') : form.name }}</div>
                    <div v-if="!isNew" class="row" style="gap:.4rem">
                        <span class="muted mono ellipsis">{{ form.mpn }}</span>
                        <Tag :value="`${totalQty} ${t('common.pcs')}`" :severity="status.severity" />
                    </div>
                </div>
                <Button :label="t('lookup.find_online')" icon="pi pi-search" size="small" outlined
                        @click="lookupOpen = true" v-tooltip.bottom="t('lookup.find_online_hint')" />
            </div>
        </template>

        <Message v-if="duplicate" severity="warn" class="dup">
            <div>{{ t('drawer.duplicate', { name: duplicate.name, mpn: duplicate.mpn, n: duplicate.quantity }) }}</div>
            <div class="row" style="margin-top:.5rem; flex-wrap: wrap">
                <Button size="small" :label="t('drawer.add_to_existing', { n: totalQty })" icon="pi pi-plus"
                        :disabled="!totalQty" @click="addToExisting" />
                <Button size="small" :label="t('drawer.open_existing')" severity="secondary" outlined @click="openComponent(duplicate.id)" />
                <Button size="small" :label="t('drawer.save_anyway')" severity="secondary" text @click="save(true)" />
            </div>
        </Message>

        <Tabs v-model:value="tab">
            <TabList>
                <Tab value="data">{{ t('drawer.tab_data') }}</Tab>
                <Tab value="photo"><i class="pi pi-image" /> {{ t('drawer.tab_photo') }}</Tab>
                <Tab value="params">{{ t('drawer.tab_params') }} <Badge v-if="form.params.length" :value="form.params.length" severity="secondary" /></Tab>
                <Tab v-if="!isNew" value="history">{{ t('drawer.tab_history') }} <Badge v-if="movements.length" :value="movements.length" severity="secondary" /></Tab>
            </TabList>
            <TabPanels>
                <!-- PODACI ------------------------------------------------>
                <TabPanel value="data">
                    <div class="form-grid">
                        <div class="field">
                            <label for="cd-name">{{ t('fields.name') }} *</label>
                            <InputText id="cd-name" v-model="form.name" fluid />
                        </div>
                        <div class="field">
                            <label for="cd-mpn">{{ t('fields.mpn') }}</label>
                            <InputText id="cd-mpn" v-model="form.mpn" class="mono" fluid />
                        </div>
                        <div class="field">
                            <label for="cd-mfr">{{ t('fields.manufacturer') }}</label>
                            <InputText id="cd-mfr" v-model="form.manufacturer" fluid />
                        </div>
                        <div class="field">
                            <label for="cd-pkg">{{ t('fields.package') }}</label>
                            <InputText id="cd-pkg" v-model="form.package" :placeholder="t('fields.package_placeholder')" fluid />
                        </div>
                        <div class="field">
                            <label for="cd-cat">{{ t('fields.category') }}</label>
                            <AutoComplete inputId="cd-cat" v-model="form.category" :suggestions="categorySuggestions" dropdown completeOnFocus
                                          :placeholder="t('fields.category_placeholder')" fluid @complete="searchCategory" />
                        </div>
                        <div class="field">
                            <label for="cd-min">{{ t('fields.min_stock') }}</label>
                            <InputNumber inputId="cd-min" v-model="form.min_stock" :min="0" showButtons buttonLayout="horizontal" fluid
                                         incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus" />
                        </div>
                        <div class="field full">
                            <label>{{ t('fields.stock_by_location') }}</label>
                            <StockEditor v-model="form.stock" />
                        </div>
                        <div class="field">
                            <label for="cd-desc">{{ t('fields.description') }}</label>
                            <Textarea id="cd-desc" v-model="form.description" rows="7" fluid class="area" />
                        </div>
                        <div class="field">
                            <label for="cd-notes">{{ t('fields.notes') }}</label>
                            <Textarea id="cd-notes" v-model="form.notes" rows="7" fluid class="area" :placeholder="t('fields.notes_placeholder')" />
                        </div>
                        <div class="field full">
                            <label for="cd-ds">{{ t('fields.datasheet') }}
                                <Tag v-if="saved?.datasheet_file && urlUnchanged('datasheet_url')" :value="t('files.local_copy')" severity="success" icon="pi pi-check" class="local" />
                            </label>
                            <div class="row">
                                <InputText id="cd-ds" v-model="form.datasheet_url" class="grow" fluid />
                                <Button v-if="datasheetLink" as="a" :href="datasheetLink" target="_blank" rel="noopener"
                                        icon="pi pi-file-pdf" severity="secondary" outlined v-tooltip="t('files.open_datasheet')" />
                                <Button v-if="!isNew && form.datasheet_url && urlUnchanged('datasheet_url') && !saved?.datasheet_file"
                                        icon="pi pi-download" severity="secondary" outlined :loading="cachingDatasheet"
                                        @click="cacheFile('datasheet')" v-tooltip="t('files.save_locally')" />
                            </div>
                        </div>
                    </div>
                </TabPanel>

                <!-- SLIKA ------------------------------------------------->
                <TabPanel value="photo">
                    <div class="photo">
                        <Image v-if="previewSrc && !imageFailed" :src="previewSrc" alt="" preview @error="imageFailed = true" />
                        <div v-else class="photo-empty muted">
                            <i class="pi pi-image" />
                            <span>{{ form.image_url ? t('files.image_unavailable') : t('files.no_image') }}</span>
                        </div>
                    </div>
                    <p v-if="previewSrc && !imageFailed" class="muted hint"><i class="pi pi-search-plus" /> {{ t('files.zoom_hint') }}</p>
                    <div class="field">
                        <label for="cd-img">{{ t('fields.image_url') }}
                            <Tag v-if="saved?.image_file && urlUnchanged('image_url')" :value="t('files.local_copy')" severity="success" icon="pi pi-check" class="local" />
                        </label>
                        <div class="row">
                            <InputText id="cd-img" v-model="form.image_url" class="grow" fluid />
                            <Button v-if="!isNew && form.image_url && urlUnchanged('image_url') && !saved?.image_file"
                                    icon="pi pi-download" severity="secondary" outlined :loading="cachingImage"
                                    @click="cacheFile('image')" v-tooltip="t('files.save_locally')" />
                        </div>
                    </div>
                </TabPanel>

                <!-- PARAMETRI --------------------------------------------->
                <TabPanel value="params">
                    <p v-if="!form.params.length" class="muted">{{ t('drawer.no_params') }}</p>
                    <div v-for="(p, i) in form.params" :key="i" class="param-row">
                        <InputText v-model="p.name" :placeholder="t('drawer.param_name')" class="pname" />
                        <InputText v-model="p.value" :placeholder="t('drawer.param_value')" class="grow" />
                        <Button icon="pi pi-trash" text rounded severity="secondary" @click="form.params.splice(i, 1)" />
                    </div>
                    <Button :label="t('drawer.add_param')" icon="pi pi-plus" text size="small" @click="addParam" />
                </TabPanel>

                <!-- ISTORIJA ---------------------------------------------->
                <TabPanel value="history">
                    <p v-if="!movements.length" class="muted">{{ t('drawer.no_history') }}</p>
                    <div v-for="m in movements" :key="m.id" class="move">
                        <Tag :value="(m.delta > 0 ? '+' : '') + m.delta" :severity="m.delta > 0 ? 'success' : 'danger'" class="mono delta" />
                        <div class="grow">
                            <div>{{ t(`movement.${m.kind}`) }}<span v-if="m.note" class="muted"> – {{ m.note }}</span></div>
                            <div class="muted small">
                                <i class="pi pi-map-marker" /> {{ m.location || t('filters.no_location') }} → {{ m.quantity_after }} {{ t('common.pcs') }}
                            </div>
                        </div>
                        <span class="muted small">{{ formatDate(m.created_at) }}</span>
                    </div>
                </TabPanel>
            </TabPanels>
        </Tabs>

        <template #footer>
            <div class="row">
                <Button v-if="!isNew" icon="pi pi-trash" :label="t('common.delete')" severity="danger" text @click="remove" />
                <Button v-if="!isNew" icon="pi pi-copy" :label="t('drawer.copy_as_new')" severity="secondary" text
                        :disabled="dirty" @click="copyAsNew" v-tooltip.top="dirty ? t('drawer.save_first') : t('drawer.copy_hint')" />
                <span class="grow" />
                <span v-if="dirty && !isNew" class="muted small">{{ t('drawer.unsaved') }}</span>
                <Button :label="t('common.close')" severity="secondary" text @click="visible = false" />
                <Button :label="isNew ? t('common.add') : t('common.save')" icon="pi pi-check" :loading="saving" v-tooltip.top="'Ctrl+S'"
                        :disabled="!isNew && !dirty" @click="save()" />
            </div>
        </template>
    </Drawer>

    <LookupDialog
        v-model:visible="lookupOpen"
        :query="lookupQuery"
        :current="form"
        :isNew="isNew"
        @apply="applyLookup"
        @open-existing="id => { lookupOpen = false; openComponent(id); }"
    />
</template>

<style scoped>
.head { gap: .75rem; outline: none; }
.thumb.big { width: 56px; height: 56px; }
.clickable { cursor: pointer; }
.title { font-weight: 700; font-size: 1.1rem; }
.dup { margin-bottom: .75rem; }
.area { resize: vertical; }
.local { margin-left: .4rem; font-size: .78rem; padding: .05rem .35rem; }
.small { font-size: .82rem; }
.photo {
    height: min(55vh, 30rem); border-radius: 10px; padding: 1rem;
    background: #fff; border: 1px solid var(--p-content-border-color);
    display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.photo :deep(.p-image) { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; cursor: zoom-in; }
.photo :deep(.p-image img) { max-width: 100%; max-height: 100%; object-fit: contain; }
.photo-empty { display: flex; flex-direction: column; align-items: center; gap: .4rem; }
.photo-empty i { font-size: 2.5rem; opacity: .4; }
.hint { text-align: center; font-size: .85rem; }
.param-row { display: flex; gap: .5rem; margin-bottom: .4rem; }
.pname { width: 40%; }
.move { display: flex; gap: .75rem; align-items: center; padding: .5rem 0; border-bottom: 1px solid var(--p-content-border-color); }
.delta { min-width: 3.2rem; justify-content: center; }
.cdrawer :deep(.p-tabpanels) { padding: 1rem 0 0; }
</style>
