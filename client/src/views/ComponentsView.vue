<script setup>
// *********************************************************************
// Komponente: filteri levo, tabela, masovne akcije, izvoz
// Filteri se čuvaju u URL-u (?q=&status=&cat=&loc=), pa rade i linkovi
// sa QR nalepnica lokacija.
// *********************************************************************
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Select from 'primevue/select';
import Menu from 'primevue/menu';
import FilterPanel from '../components/FilterPanel.vue';
import QtyCell from '../components/QtyCell.vue';
import { api } from '../api.js';
import { store, loadAll, openComponent, dropComponents, stockStatus, imageSrc, locationWithChildren } from '../store.js';
import { exportCsv, exportTxt } from '../export.js';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const route = useRoute();
const router = useRouter();

// --- Filteri <-> URL -------------------------------------------------
const parseIds = s => (s ? String(s).split(',').map(x => (x === 'none' ? 'none' : Number(x))).filter(Boolean) : []);
const filters = ref({
    q: String(route.query.q || ''),
    status: ['low', 'out'].includes(route.query.status) ? route.query.status : 'all',
    categories: parseIds(route.query.cat),
    locations: parseIds(route.query.loc)
});

watch(filters, f => {
    const query = {};
    if (f.q) query.q = f.q;
    if (f.status !== 'all') query.status = f.status;
    if (f.categories.length) query.cat = f.categories.join(',');
    if (f.locations.length) query.loc = f.locations.join(',');
    router.replace({ query });
}, { deep: true });

// Oznake uključenih filtera iznad tabele – svaka se skida klikom na ×
const activeChips = computed(() => {
    const f = filters.value, chips = [];
    if (f.status !== 'all') chips.push({ key: 'status', icon: 'pi pi-exclamation-circle', label: t(`status.${f.status}`),
        remove: () => (f.status = 'all') });
    for (const id of f.categories) chips.push({ key: `c${id}`, icon: 'pi pi-tag',
        label: id === 'none' ? t('filters.no_category') : store.categories.find(c => c.id === id)?.name ?? '?',
        remove: () => f.categories.splice(f.categories.indexOf(id), 1) });
    for (const id of f.locations) chips.push({ key: `l${id}`, icon: 'pi pi-map-marker',
        label: id === 'none' ? t('filters.no_location') : store.locations.find(l => l.id === id)?.path ?? '?',
        remove: () => f.locations.splice(f.locations.indexOf(id), 1) });
    return chips;
});
const clearFilters = () => Object.assign(filters.value, { status: 'all', categories: [], locations: [] });

// --- Filtriranje -----------------------------------------------------
const filtered = computed(() => {
    const f = filters.value;
    const tokens = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const cats = new Set(f.categories);
    // izabrana lokacija uključuje i sve svoje podlokacije
    const locs = new Set();
    for (const id of f.locations) {
        if (id === 'none') locs.add('none');
        else for (const x of locationWithChildren(id)) locs.add(x);
    }
    return store.components.filter(c => {
        if (f.status !== 'all' && stockStatus(c).key !== f.status) return false;
        if (cats.size && !cats.has(c.category_id ?? 'none')) return false;
        if (locs.size) {
            const ids = c.stock.map(s => s.location_id).filter(Boolean);
            if (!(ids.some(id => locs.has(id)) || (locs.has('none') && !ids.length))) return false;
        }
        if (!tokens.length) return true;
        const hay = [c.name, c.mpn, c.manufacturer, c.package, c.category, c.description, c.notes,
            ...c.stock.map(s => s.location)].join(' ').toLowerCase();
        return tokens.every(tok => hay.includes(tok));
    });
});

// --- Masovne akcije --------------------------------------------------
const selection = ref([]);
const bulkLocation = ref(null);
const bulkCategory = ref(null);

async function runBulk(action, value) {
    const ids = selection.value.map(c => c.id);
    try {
        const r = await api.bulk(ids, action, value);
        toast.add({ severity: 'success', summary: t('common.done'), detail: t('bulk.changed', { n: r.changed }), life: 2500 });
        if (action === 'delete') dropComponents(ids);
        selection.value = [];
        bulkLocation.value = bulkCategory.value = null;
        await loadAll();
    } catch (e) {
        toast.add({ severity: 'error', summary: t('common.error'), detail: e.message, life: 5000 });
    }
}

function bulkDelete() {
    confirm.require({
        header: t('common.delete'),
        message: t('bulk.delete_confirm', { n: selection.value.length }),
        icon: 'pi pi-exclamation-triangle',
        acceptProps: { label: t('common.delete'), severity: 'danger' },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: () => runBulk('delete')
    });
}

// --- Izvoz -----------------------------------------------------------
const exportMenu = ref();
const exportItems = computed(() => [
    { label: t('export.csv'), icon: 'pi pi-file-excel', command: () => exportCsv(rowsForExport(), t) },
    { label: t('export.txt'), icon: 'pi pi-file', command: () => exportTxt(rowsForExport(), t) }
]);
const rowsForExport = () => (selection.value.length ? selection.value : filtered.value);

const locationLabel = c => {
    const locs = c.stock.filter(s => s.location);
    if (!locs.length) return '';
    return locs.length === 1 ? locs[0].location : `${locs[0].location} +${locs.length - 1}`;
};
const hideImage = e => (e.target.style.display = 'none');
</script>

<template>
    <div class="page layout">
        <FilterPanel v-model="filters" class="sidebar" />

        <section class="card content">
            <div class="toolbar">
                <IconField class="search">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="filters.q" :placeholder="t('components.search_placeholder')" fluid />
                </IconField>
                <span class="muted count">{{ t('components.count', { n: filtered.length, total: store.components.length }) }}</span>
                <Button icon="pi pi-download" :label="t('export.title')" severity="secondary" outlined size="small"
                        @click="exportMenu.toggle($event)" />
                <Menu ref="exportMenu" :model="exportItems" popup />
            </div>

            <div v-if="activeChips.length" class="chips">
                <button v-for="c in activeChips" :key="c.key" class="chip" @click="c.remove()" :title="t('filters.remove')">
                    <i :class="c.icon" /> <span>{{ c.label }}</span> <i class="pi pi-times x" />
                </button>
                <a v-if="activeChips.length > 1" href="#" class="clear" @click.prevent="clearFilters">{{ t('filters.clear_all') }}</a>
            </div>

            <!-- Traka za masovne akcije – vidi se samo kad ima selektovanih -->
            <div v-if="selection.length" class="bulkbar">
                <strong>{{ t('bulk.selected', { n: selection.length }) }}</strong>
                <Select v-model="bulkLocation" :options="store.locations" optionLabel="path" optionValue="id" filter
                        :placeholder="t('bulk.location_placeholder')" class="bulk-select" />
                <Button :label="t('bulk.move')" icon="pi pi-box" size="small" outlined :disabled="!bulkLocation"
                        @click="runBulk('location', bulkLocation)" v-tooltip.bottom="t('bulk.move_hint')" />
                <Select v-model="bulkCategory" :options="store.categories" optionLabel="name" optionValue="id" filter
                        :placeholder="t('bulk.category_placeholder')" class="bulk-select" />
                <Button :label="t('bulk.set_category')" icon="pi pi-tag" size="small" outlined :disabled="!bulkCategory"
                        @click="runBulk('category', bulkCategory)" />
                <span class="grow" />
                <Button :label="t('common.delete')" icon="pi pi-trash" size="small" severity="danger" text @click="bulkDelete" />
                <Button icon="pi pi-times" size="small" text severity="secondary" @click="selection = []" v-tooltip="t('bulk.clear')" />
            </div>

            <DataTable
                v-model:selection="selection"
                :value="filtered"
                dataKey="id"
                size="small"
                rowHover
                paginator
                :rows="25"
                :rowsPerPageOptions="[25, 50, 100, 500]"
                sortMode="multiple"
                removableSort
                scrollable
                scrollHeight="flex"
                class="table"
                @row-click="e => openComponent(e.data.id)"
            >
                <template #empty><div class="empty muted">{{ t('components.empty') }}</div></template>

                <Column selectionMode="multiple" style="width: 3rem" />

                <Column :header="t('fields.component')" field="name" sortable style="min-width: 13rem">
                    <template #body="{ data }">
                        <div class="row">
                            <div class="thumb">
                                <img v-if="imageSrc(data)" :src="imageSrc(data)" alt="" loading="lazy" @error="hideImage" />
                                <i v-else class="pi pi-microchip" />
                            </div>
                            <div class="grow cell-main">
                                <div class="ellipsis" :title="data.name"><strong>{{ data.name }}</strong></div>
                                <div class="muted mono ellipsis" :title="[data.mpn, data.manufacturer].filter(Boolean).join(' · ')">
                                    {{ data.mpn || '—' }}<template v-if="data.manufacturer"> · {{ data.manufacturer }}</template>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>
                <Column :header="t('fields.category')" field="category" sortable style="min-width: 8rem" />
                <Column :header="t('fields.package')" field="package" sortable style="min-width: 5rem">
                    <template #body="{ data }"><span class="mono">{{ data.package || '' }}</span></template>
                </Column>
                <Column :header="t('fields.location')" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span v-if="locationLabel(data)" class="loc" v-tooltip="data.stock.map(s => s.location).filter(Boolean).join('\n')">
                            <i class="pi pi-map-marker muted" style="font-size:.8rem" /> {{ locationLabel(data) }}
                        </span>
                    </template>
                </Column>
                <Column :header="t('fields.stock')" field="quantity" sortable style="min-width: 10rem">
                    <template #body="{ data }"><QtyCell :component="data" /></template>
                </Column>
            </DataTable>
        </section>
    </div>
</template>

<style scoped>
.loc { display: inline-block; line-height: 1.3; }
/* bez gornje granice tabela se širi po najdužem nazivu/proizvođaču i "…" ne radi */
.cell-main { max-width: 22rem; }
.layout { display: grid; grid-template-columns: 20rem minmax(0, 1fr); height: 100%; flex-direction: unset; }
.sidebar { overflow: auto; }
.content { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.toolbar { display: flex; align-items: center; gap: .75rem; padding: .6rem .75rem; border-bottom: 1px solid var(--p-content-border-color); }
.search { flex: 1; max-width: 34rem; }
.count { font-size: .85rem; white-space: nowrap; }
.toolbar .p-button { margin-left: auto; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; padding: .5rem .75rem; border-bottom: 1px solid var(--p-content-border-color); }
.chip {
    display: inline-flex; align-items: center; gap: .4rem; padding: .25rem .6rem; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--p-primary-color); background: var(--p-highlight-background); color: var(--p-highlight-color); font: inherit; font-size: .88rem;
}
.chip:hover { filter: brightness(1.15); }
.chip i { font-size: .78rem; }
.chip .x { opacity: .7; }
.clear { font-size: .88rem; margin-left: .3rem; text-decoration: none; }
.bulkbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding: .5rem .75rem;
    background: var(--p-highlight-background); border-bottom: 1px solid var(--p-content-border-color);
}
.bulk-select { width: 13rem; }
.table { flex: 1; min-height: 0; }
.empty { padding: 2rem; text-align: center; }
:deep(.p-datatable-tbody > tr) { cursor: pointer; }

/* manji laptop (npr. 1366px): uži filteri da tabela stane bez skrolovanja */
@media (max-width: 1440px) {
    .layout { grid-template-columns: 16rem minmax(0, 1fr); }
    .cell-main { max-width: 13rem; }
}
@media (max-width: 1000px) {
    .layout { grid-template-columns: minmax(0, 1fr); height: auto; }
    .sidebar { max-height: 14rem; }
    .content { height: 78vh; }
    .count { display: none; }
}
</style>
