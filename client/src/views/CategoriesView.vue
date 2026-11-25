<script setup>
// Kategorije: dodavanje, preimenovanje (klik na naziv), brisanje uz premeštanje komponenti
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import { api } from '../api.js';
import { store, loadAll, notifyTrashed } from '../store.js';

const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const newName = ref('');
const search = ref('');
const rows = computed(() => store.categories.filter(c => c.name.toLowerCase().includes(search.value.toLowerCase())));

async function add() {
    if (!newName.value.trim()) return;
    try {
        await api.createCategory(newName.value.trim());
        newName.value = '';
        await loadAll();
    } catch (e) {
        toast.add({ severity: 'error', summary: t('common.error'), detail: e.message, life: 4000 });
    }
}

// Izmena u ćeliji: klik na naziv → upis → Enter
async function onCellEdit(e) {
    const name = String(e.newValue || '').trim();
    if (!name || name === e.data.name) return;
    try {
        await api.updateCategory(e.data.id, name);
        await loadAll();
        toast.add({ severity: 'success', summary: t('common.saved'), life: 1500 });
    } catch (err) {
        toast.add({ severity: 'error', summary: t('common.error'), detail: err.message, life: 4000 });
    }
}

const del = ref({ visible: false, cat: null, moveTo: null });
const openDelete = cat => (del.value = { visible: true, cat, moveTo: null });
const moveOptions = computed(() => store.categories.filter(c => c.id !== del.value.cat?.id));

async function confirmDelete() {
    const r = await api.deleteCategory(del.value.cat.id, del.value.moveTo);
    del.value.visible = false;
    await loadAll();
    notifyTrashed(t('trash.moved_one', { name: del.value.cat.name }), r.trash);
}

const showComponents = id => router.push({ path: '/components', query: { cat: id } });
</script>

<template>
    <div class="page narrow">
        <div class="page-head"><h1>{{ t('nav.categories') }}</h1></div>

        <section class="card">
            <div class="toolbar">
                <form class="row grow" @submit.prevent="add">
                    <InputText v-model="newName" :placeholder="t('categories.new_placeholder')" class="grow" />
                    <Button type="submit" :label="t('common.add')" icon="pi pi-plus" :disabled="!newName.trim()" />
                </form>
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="search" :placeholder="t('common.search')" @keydown.esc="search = ''" />
                    <InputIcon v-if="search" class="pi pi-times" style="cursor: pointer" @click="search = ''" />
                </IconField>
            </div>

            <DataTable :value="rows" dataKey="id" size="small" editMode="cell" @cell-edit-complete="onCellEdit"
                       sortField="name" :sortOrder="1" rowHover>
                <Column field="name" :header="t('fields.name')" sortable>
                    <template #body="{ data }"><span class="editable">{{ data.name }} <i class="pi pi-pencil" /></span></template>
                    <template #editor="{ data, field }"><InputText v-model="data[field]" autofocus fluid size="small" /></template>
                </Column>
                <Column field="component_count" :header="t('locations.components')" sortable style="width: 10rem">
                    <template #body="{ data }">
                        <a href="#" @click.prevent="showComponents(data.id)">{{ data.component_count }}</a>
                    </template>
                </Column>
                <Column style="width: 4rem">
                    <template #body="{ data }">
                        <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="openDelete(data)" v-tooltip="t('common.delete')" />
                    </template>
                </Column>
            </DataTable>
        </section>
        <p class="muted small">{{ t('categories.edit_hint') }}</p>
    </div>

    <Dialog v-model:visible="del.visible" modal :header="t('categories.delete_title')" :style="{ width: 'min(28rem, 95vw)' }">
        <p>{{ t('categories.delete_text', { name: del.cat?.name, n: del.cat?.component_count }) }}</p>
        <div v-if="del.cat?.component_count" class="field">
            <label for="cat-move">{{ t('categories.move_to') }}</label>
            <Select labelId="cat-move" v-model="del.moveTo" :options="moveOptions" optionLabel="name" optionValue="id" filter showClear
                    :placeholder="t('filters.no_category')" fluid />
        </div>
        <template #footer>
            <Button :label="t('common.cancel')" severity="secondary" text @click="del.visible = false" />
            <Button :label="t('common.delete')" severity="danger" icon="pi pi-trash" @click="confirmDelete" />
        </template>
    </Dialog>
</template>

<style scoped>
.narrow { max-width: 52rem; }
.toolbar { display: flex; gap: .75rem; padding: .75rem; border-bottom: 1px solid var(--p-content-border-color); flex-wrap: wrap; }
.editable { cursor: text; }
.editable i { font-size: .78rem; opacity: 0; margin-left: .3rem; color: var(--p-text-muted-color); }
tr:hover .editable i { opacity: 1; }
.small { font-size: .85rem; }
</style>
