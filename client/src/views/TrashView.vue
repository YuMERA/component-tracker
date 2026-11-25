<script setup>
// *********************************************************************
// Kanta: sve obrisano (komponente, lokacije, kategorije) čeka ovde dok se
// kanta ne isprazni. Vraćanje vraća i ono što je brisanje prebacilo
// (komade sa lokacije, komponente iz kategorije).
// *********************************************************************
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import { api } from '../api.js';
import { loadAll, refreshTrashCount } from '../store.js';

const { t, d } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const items = ref([]);
const loading = ref(true);
const busy = ref(null);

async function load() {
    loading.value = true;
    try { items.value = await api.trash(); }
    finally { loading.value = false; }
    refreshTrashCount();
}
onMounted(load);

const ICON = { component: 'pi pi-microchip', location: 'pi pi-map-marker', category: 'pi pi-tags' };
const fmtDate = s => d(new Date(s.replace(' ', 'T') + 'Z'), 'short');

// Šta je obuhvaćeno, npr. "MPN · 45 kom" ili "2 podlokacije · 45 kom"
function detail(item) {
    const x = item.detail || {};
    if (item.kind === 'component') return [x.mpn, t('trash.pieces', { n: x.quantity || 0 })].filter(Boolean).join(' · ');
    if (item.kind === 'location') return [x.children ? t('trash.children', { n: x.children }) : null, x.pieces ? t('trash.pieces', { n: x.pieces }) : null].filter(Boolean).join(' · ');
    return x.components ? t('trash.components', { n: x.components }) : '';
}

// Napomene posle vraćanja (npr. lokacija više ne postoji → komadi su bez lokacije)
function notesText(r) {
    return (r.notes || []).map(n => t(`trash.note_${n}`)).join(' ');
}

const error = e => toast.add({ severity: 'error', summary: t('common.error'), detail: e.message, life: 5000 });

async function afterChange() {
    await Promise.all([load(), loadAll()]);
}

// Vraćanje traži potvrdu – da jedan slučajan klik ne promeni podatke
function askRestore(item) {
    confirm.require({
        header: t('trash.restore_title'),
        message: t(`trash.restore_confirm_${item.kind}`, { name: item.label }),
        icon: 'pi pi-replay',
        acceptProps: { label: t('trash.restore') },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: () => restore(item)
    });
}

async function restore(item, force = false) {
    busy.value = item.id;
    try {
        const r = await api.restoreTrash(item.id, force);
        await afterChange();
        toast.add({ severity: 'success', summary: t('trash.restored', { name: item.label }), detail: notesText(r) || undefined, life: 4000 });
    } catch (e) {
        // komponenta sa istim MPN-om je u međuvremenu dodata
        if (e.status === 409 && e.data?.existing) {
            confirm.require({
                header: t('trash.mpn_exists_title'),
                message: t('trash.mpn_exists', { name: e.data.existing.name, mpn: e.data.existing.mpn }),
                icon: 'pi pi-exclamation-triangle',
                acceptProps: { label: t('trash.restore_anyway') },
                rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
                accept: () => restore(item, true)
            });
        } else error(e);
    } finally {
        busy.value = null;
    }
}

function purge(item) {
    confirm.require({
        header: t('trash.purge_title'),
        message: t('trash.purge_confirm', { name: item.label }),
        icon: 'pi pi-exclamation-triangle',
        acceptProps: { label: t('trash.purge'), severity: 'danger' },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: async () => {
            try { await api.purgeTrash(item.id); await load(); } catch (e) { error(e); }
        }
    });
}

function askRestoreAll() {
    confirm.require({
        header: t('trash.restore_all'),
        message: t('trash.restore_all_confirm', { n: items.value.length }),
        icon: 'pi pi-replay',
        acceptProps: { label: t('trash.restore_all') },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: restoreAll
    });
}

async function restoreAll() {
    busy.value = 'all';
    try {
        const r = await api.restoreTrashMany();
        await afterChange();
        toast.add({ severity: 'success', summary: t('trash.restored_n', { n: r.restored }), life: 4000 });
        if (r.skipped.length) {
            toast.add({ severity: 'warn', summary: t('trash.skipped', { n: r.skipped.length }), detail: r.skipped.join(', '), life: 8000 });
        }
    } catch (e) { error(e); }
    finally { busy.value = null; }
}

function emptyAll() {
    confirm.require({
        header: t('trash.empty'),
        message: t('trash.empty_confirm', { n: items.value.length }),
        icon: 'pi pi-exclamation-triangle',
        acceptProps: { label: t('trash.empty'), severity: 'danger' },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: async () => {
            try { await api.emptyTrash(); await load(); } catch (e) { error(e); }
        }
    });
}
</script>

<template>
    <div class="page">
        <div class="page-head">
            <h1>{{ t('nav.trash') }}</h1>
            <span class="grow" />
            <Button v-if="items.length" :label="t('trash.restore_all')" icon="pi pi-replay" severity="secondary" outlined
                    :loading="busy === 'all'" @click="askRestoreAll" />
            <Button v-if="items.length" :label="t('trash.empty')" icon="pi pi-trash" severity="danger" outlined @click="emptyAll" />
        </div>
        <p class="muted intro">{{ t('trash.intro') }}</p>

        <section class="card">
            <DataTable :value="items" :loading="loading" dataKey="id" size="small" rowHover>
                <template #empty>
                    <div class="empty muted"><i class="pi pi-trash" /> {{ t('trash.is_empty') }}</div>
                </template>
                <Column :header="t('trash.item')">
                    <template #body="{ data }">
                        <div class="row item">
                            <i :class="ICON[data.kind]" v-tooltip="t(`trash.kind_${data.kind}`)" />
                            <div class="grow">
                                <strong>{{ data.label }}</strong>
                                <div class="muted small">{{ t(`trash.kind_${data.kind}`) }}<template v-if="detail(data)"> · {{ detail(data) }}</template></div>
                                <div class="muted small mobile-date">{{ fmtDate(data.deleted_at) }}</div>
                            </div>
                        </div>
                    </template>
                </Column>
                <Column :header="t('trash.deleted_at')" style="width: 12rem" headerClass="wide-only" bodyClass="wide-only">
                    <template #body="{ data }"><span class="muted">{{ fmtDate(data.deleted_at) }}</span></template>
                </Column>
                <Column style="width: 1%; white-space: nowrap">
                    <template #body="{ data }">
                        <div class="row actions">
                            <Button :label="t('trash.restore')" icon="pi pi-replay" size="small" outlined class="restore-btn"
                                    :loading="busy === data.id" @click="askRestore(data)" />
                            <Button :label="t('trash.purge')" icon="pi pi-trash" size="small" outlined severity="danger" class="restore-btn"
                                    @click="purge(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </section>
    </div>
</template>

<style scoped>
.page-head { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.intro { margin: 0 0 1rem; }
.item { gap: .8rem; }
.item > i { font-size: 1.1rem; color: var(--p-primary-color); width: 1.4rem; text-align: center; }
.small { font-size: .85rem; }
.actions { justify-content: flex-end; gap: .5rem; }
.empty { padding: 2.5rem; text-align: center; }
.empty i { margin-right: .4rem; }
.mobile-date { display: none; }
@media (max-width: 760px) {
    :deep(.wide-only) { display: none; }
    .mobile-date { display: block; }
    .restore-btn :deep(.p-button-label) { display: none; }
}
</style>
