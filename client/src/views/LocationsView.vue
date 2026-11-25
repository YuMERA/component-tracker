<script setup>
// *********************************************************************
// Lokacije: stablo (Ormar → Fioka → Kutija), dodavanje, premeštanje,
// brisanje i štampa QR nalepnica koje otvaraju listu komponenti na toj lokaciji
// *********************************************************************
import { ref, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import QRCode from 'qrcode';
import TreeTable from 'primevue/treetable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Message from 'primevue/message';
import { api } from '../api.js';
import { store, reloadCatalog, loadAll, locationWithChildren } from '../store.js';

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// --- Stablo ----------------------------------------------------------
const nodes = computed(() => {
    const byParent = new Map();
    for (const l of store.locations) {
        const k = l.parent_id ?? 0;
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(l);
    }
    const build = pid => (byParent.get(pid) || []).map(l => ({ key: String(l.id), data: l, children: build(l.id) }));
    return build(0);
});
const expandedKeys = ref(Object.fromEntries(store.locations.map(l => [String(l.id), true])));
const selectedKeys = ref({});
const selectedIds = computed(() => Object.entries(selectedKeys.value).filter(([, v]) => v.checked).map(([k]) => Number(k)));

// Ukupno sa podlokacijama
const totals = computed(() => {
    const m = new Map();
    for (const l of store.locations) {
        const ids = locationWithChildren(l.id);
        const comps = new Set();
        let qty = 0;
        for (const c of store.components) for (const s of c.stock) {
            if (s.location_id && ids.has(s.location_id)) { comps.add(c.id); qty += s.quantity; }
        }
        m.set(l.id, { components: comps.size, quantity: qty });
    }
    return m;
});

// --- Dodavanje / izmena ----------------------------------------------
const dialog = ref({ visible: false, id: null, name: '', parent_id: null, description: '' });
const parentOptions = computed(() => {
    const blocked = dialog.value.id ? locationWithChildren(dialog.value.id) : new Set();
    return store.locations.filter(l => !blocked.has(l.id));
});

const openAdd = (parentId = null) => (dialog.value = { visible: true, id: null, name: '', parent_id: parentId, description: '' });
const openEdit = l => (dialog.value = { visible: true, id: l.id, name: l.name, parent_id: l.parent_id, description: l.description || '' });

async function saveLocation() {
    const { id, name, parent_id, description } = dialog.value;
    if (!name.trim()) return;
    try {
        if (id) await api.updateLocation(id, { name, parent_id, description });
        else await api.createLocation({ name, parent_id, description });
        if (parent_id) expandedKeys.value[String(parent_id)] = true;
        dialog.value.visible = false;
        await loadAll();      // putanje lokacija u komponentama se menjaju
    } catch (e) {
        toast.add({ severity: 'error', summary: t('common.error'), detail: e.message, life: 5000 });
    }
}

function removeLocation(l) {
    const parent = store.locations.find(x => x.id === l.parent_id);
    confirm.require({
        header: t('common.delete'),
        message: t('locations.delete_confirm', { name: l.path, target: parent ? parent.path : t('filters.no_location') }),
        icon: 'pi pi-exclamation-triangle',
        acceptProps: { label: t('common.delete'), severity: 'danger' },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: async () => {
            await api.deleteLocation(l.id);
            await loadAll();
            toast.add({ severity: 'success', summary: t('common.done'), life: 2000 });
        }
    });
}

const showComponents = id => router.push({ path: '/components', query: { loc: id } });

// --- QR nalepnice ----------------------------------------------------
const printDialog = ref({ visible: false, base: '', options: [] });
const labels = ref([]);

async function openPrint(ids) {
    const sys = await api.system().catch(() => ({ lan_urls: [] }));
    const options = [...new Set([...(sys.lan_urls || []), location.origin])];
    printDialog.value = { visible: true, base: options[0], options, ids };
}

async function print() {
    const base = printDialog.value.base.replace(/\/$/, '');
    labels.value = await Promise.all(printDialog.value.ids.map(async id => {
        const l = store.locations.find(x => x.id === id);
        const url = `${base}/components?loc=${id}`;
        return { id, path: l.path, name: l.name, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }) };
    }));
    printDialog.value.visible = false;
    await nextTick();
    window.print();
}
</script>

<template>
    <div class="page">
        <div class="page-head">
            <h1>{{ t('nav.locations') }}</h1>
            <span class="grow" />
            <Button v-if="selectedIds.length" :label="t('locations.print_selected', { n: selectedIds.length })" icon="pi pi-qrcode"
                    severity="secondary" outlined @click="openPrint(selectedIds)" />
            <Button :label="t('locations.add')" icon="pi pi-plus" @click="openAdd()" />
        </div>
        <p class="muted intro">{{ t('locations.intro') }}</p>

        <section class="card">
            <TreeTable :value="nodes" v-model:expandedKeys="expandedKeys" v-model:selectionKeys="selectedKeys"
                       selectionMode="checkbox" size="small" class="tree">
                <template #empty><div class="muted empty">{{ t('locations.empty') }}</div></template>
                <Column :header="t('fields.name')" expander style="min-width: 18rem">
                    <template #body="{ node }">
                        <span class="name" @click="showComponents(node.data.id)">{{ node.data.name }}</span>
                        <div v-if="node.data.description" class="muted small">{{ node.data.description }}</div>
                    </template>
                </Column>
                <Column :header="t('locations.components')" style="width: 9rem">
                    <template #body="{ node }"><span class="num">{{ totals.get(node.data.id)?.components }}</span></template>
                </Column>
                <Column :header="t('fields.quantity')" style="width: 9rem">
                    <template #body="{ node }"><span class="num">{{ totals.get(node.data.id)?.quantity }}</span></template>
                </Column>
                <Column style="width: 13rem">
                    <template #body="{ node }">
                        <div class="actions">
                            <Button icon="pi pi-list" text rounded size="small" severity="secondary" @click="showComponents(node.data.id)" v-tooltip="t('locations.show_components')" />
                            <Button icon="pi pi-plus" text rounded size="small" severity="secondary" @click="openAdd(node.data.id)" v-tooltip="t('locations.add_child')" />
                            <Button icon="pi pi-pencil" text rounded size="small" severity="secondary" @click="openEdit(node.data)" v-tooltip="t('common.edit')" />
                            <Button icon="pi pi-qrcode" text rounded size="small" severity="secondary" @click="openPrint([node.data.id])" v-tooltip="t('locations.print_label')" />
                            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="removeLocation(node.data)" v-tooltip="t('common.delete')" />
                        </div>
                    </template>
                </Column>
            </TreeTable>
        </section>
    </div>

    <!-- Dodavanje / izmena -->
    <Dialog v-model:visible="dialog.visible" modal :header="dialog.id ? t('locations.edit') : t('locations.add')" :style="{ width: 'min(30rem, 95vw)' }">
        <form class="dform" @submit.prevent="saveLocation">
            <div class="field">
                <label for="loc-name">{{ t('fields.name') }} *</label>
                <InputText id="loc-name" v-model="dialog.name" autofocus fluid />
            </div>
            <div class="field">
                <label for="loc-parent">{{ t('locations.parent') }}</label>
                <Select labelId="loc-parent" v-model="dialog.parent_id" :options="parentOptions" optionLabel="path" optionValue="id"
                        showClear filter :placeholder="t('locations.top_level')" fluid />
            </div>
            <div class="field">
                <label for="loc-desc">{{ t('fields.description') }}</label>
                <InputText id="loc-desc" v-model="dialog.description" fluid />
            </div>
            <button type="submit" hidden />
        </form>
        <template #footer>
            <Button :label="t('common.cancel')" severity="secondary" text @click="dialog.visible = false" />
            <Button :label="t('common.save')" icon="pi pi-check" :disabled="!dialog.name.trim()" @click="saveLocation" />
        </template>
    </Dialog>

    <!-- Štampa QR nalepnica -->
    <Dialog v-model:visible="printDialog.visible" modal :header="t('locations.print_title')" :style="{ width: 'min(32rem, 95vw)' }">
        <p class="muted">{{ t('locations.print_hint') }}</p>
        <div class="field">
            <label for="qr-base">{{ t('locations.qr_address') }}</label>
            <Select inputId="qr-base" v-model="printDialog.base" :options="printDialog.options" editable fluid />
        </div>
        <Message v-if="printDialog.base?.includes('localhost')" severity="warn" class="mt">{{ t('locations.localhost_warning') }}</Message>
        <template #footer>
            <Button :label="t('common.cancel')" severity="secondary" text @click="printDialog.visible = false" />
            <Button :label="t('locations.print')" icon="pi pi-print" @click="print" />
        </template>
    </Dialog>

    <!-- Sadržaj koji se štampa -->
    <div class="print-only">
        <div class="labels">
            <div v-for="l in labels" :key="l.id" class="label">
                <img :src="l.qr" alt="" />
                <div>
                    <div class="lname">{{ l.name }}</div>
                    <div class="lpath">{{ l.path }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.intro { margin: -.5rem 0 0; }
.tree :deep(.p-treetable-tbody > tr > td) { padding-top: .35rem; padding-bottom: .35rem; }
.name { font-weight: 600; cursor: pointer; }
.name:hover { color: var(--p-primary-color); text-decoration: underline; }
.small { font-size: .82rem; }
.actions { display: flex; justify-content: flex-end; }
.empty { padding: 2rem; text-align: center; }
.dform { display: flex; flex-direction: column; gap: .9rem; }
.mt { margin-top: .75rem; }

.labels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; padding: 6mm; }
.label { display: flex; align-items: center; gap: 3mm; border: 1px dashed #999; padding: 3mm; break-inside: avoid; color: #000; font-family: system-ui, sans-serif; }
.label img { width: 26mm; height: 26mm; }
.lname { font-weight: 700; font-size: 12pt; }
.lpath { font-size: 8pt; color: #444; margin-top: 1mm; }
</style>
