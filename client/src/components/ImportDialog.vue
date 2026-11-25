<script setup>
// *********************************************************************
// Uvoz liste komponenti iz CSV fajla (Excel → Sačuvaj kao → CSV)
// 1. izbor fajla  2. kolone se prepoznaju same (mogu se promeniti)
// 3. pregled: šta je novo, šta već postoji  4. uvoz u jednom koraku
// *********************************************************************
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { api } from '../api.js';
import { loadAll } from '../store.js';
import { readText, parseCsv, guessMapping, IMPORT_FIELDS } from '../csv.js';

const visible = defineModel('visible', { default: false });
const { t } = useI18n();
const toast = useToast();

const fileName = ref('');
const header = ref([]);
const data = ref([]);            // redovi fajla bez zaglavlja
const mapping = ref({});
const existing = ref('skip');
const preview = ref(null);
const error = ref('');
const busy = ref(false);
const fileInput = ref(null);

const FIELD_LABEL = {
    name: 'fields.name', mpn: 'fields.mpn', manufacturer: 'fields.manufacturer', package: 'fields.package',
    category: 'fields.category', location: 'fields.location', quantity: 'fields.quantity', min_stock: 'fields.min_stock',
    description: 'fields.description', datasheet_url: 'fields.datasheet'
};
const columnOptions = computed(() => [{ label: '—', value: null }, ...header.value.map((h, i) => ({ label: h || `#${i + 1}`, value: i }))]);
const existingOptions = computed(() => [
    { label: t('import.existing_skip'), value: 'skip' },
    { label: t('import.existing_add'), value: 'add' }
]);

function reset() {
    fileName.value = ''; header.value = []; data.value = []; mapping.value = {}; preview.value = null; error.value = '';
    if (fileInput.value) fileInput.value.value = '';
}
watch(visible, v => { if (v) reset(); });

async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileName.value = ''; header.value = []; data.value = []; preview.value = null; error.value = '';
    try {
        const rows = parseCsv(await readText(file));
        if (rows.length < 2) throw new Error(t('import.too_short'));
        fileName.value = file.name;
        header.value = rows[0].map(h => h.trim());
        data.value = rows.slice(1);
        mapping.value = guessMapping(header.value);
    } catch (err) {
        error.value = err.message;
    }
}

// Redovi u obliku koji server očekuje
const payloadRows = computed(() => data.value.map(r => {
    const o = {};
    for (const f of IMPORT_FIELDS) if (mapping.value[f] != null) o[f] = r[mapping.value[f]] ?? '';
    return o;
}));

// Pregled se osvežava kad se promeni fajl, kolone ili način za postojeće
let timer;
watch([payloadRows, existing], () => {
    clearTimeout(timer);
    if (!data.value.length || mapping.value.name == null) { preview.value = null; return; }
    timer = setTimeout(async () => {
        try {
            preview.value = await api.importComponents({ rows: payloadRows.value, existing: existing.value, dryRun: true });
            error.value = '';
        } catch (err) { error.value = err.message; }
    }, 250);
});

const previewRows = computed(() => (preview.value?.rows || []).map(p => ({ ...p, src: payloadRows.value[p.row] || {}, line: p.row + 2 })));
const toImport = computed(() => (preview.value ? preview.value.summary.new + preview.value.summary.add : 0));
const STATUS = { new: 'success', add: 'info', skip: 'secondary', error: 'danger' };

async function runImport() {
    busy.value = true;
    try {
        const r = await api.importComponents({ rows: payloadRows.value, existing: existing.value });
        await loadAll();
        toast.add({ severity: 'success', summary: t('import.done', r.summary), life: 5000 });
        visible.value = false;
    } catch (err) {
        error.value = err.message;
    } finally {
        busy.value = false;
    }
}

// Primer fajla sa zaglavljem na jeziku aplikacije
function downloadSample() {
    const head = IMPORT_FIELDS.map(f => t(FIELD_LABEL[f]));
    const rows = [
        ['10k 0805', 'RC0805FR-0710KL', 'Yageo', '0805', 'Resistors', 'Cabinet › Drawer 1', '100', '20', '10 kΩ 1% 0.125 W', ''],
        ['NE555', 'NE555P', 'Texas Instruments', 'DIP-8', 'IC', 'Cabinet › Drawer 2', '5', '2', 'Timer', '']
    ];
    const esc = v => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = '﻿' + [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'component-tracker-import.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
</script>

<template>
    <Dialog v-model:visible="visible" modal :header="t('import.title')" :style="{ width: 'min(60rem, 96vw)' }" :draggable="false">
        <p class="muted intro">
            {{ t('import.intro') }}
            <a href="#" @click.prevent="downloadSample">{{ t('import.sample') }}</a>
        </p>

        <div class="row file">
            <input ref="fileInput" type="file" accept=".csv,.txt,text/csv" class="hidden" @change="onFile" />
            <Button :label="t('import.choose')" icon="pi pi-file" outlined @click="fileInput.click()" />
            <span v-if="fileName" class="mono">{{ fileName }} · {{ t('import.n_rows', { n: data.length }) }}</span>
        </div>

        <Message v-if="error" severity="error" class="mt">{{ error }}</Message>

        <template v-if="header.length">
            <h4>{{ t('import.columns') }}</h4>
            <div class="mapping">
                <label v-for="f in IMPORT_FIELDS" :key="f">
                    <span>{{ t(FIELD_LABEL[f]) }}<b v-if="f === 'name'"> *</b></span>
                    <Select v-model="mapping[f]" :options="columnOptions" optionLabel="label" optionValue="value" size="small" fluid />
                </label>
            </div>
            <Message v-if="mapping.name == null && mapping.mpn == null" severity="warn" class="mt">{{ t('import.need_name') }}</Message>

            <div class="row existing">
                <span>{{ t('import.existing') }}</span>
                <SelectButton v-model="existing" :options="existingOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" />
            </div>

            <template v-if="preview">
                <div class="row summary">
                    <Tag severity="success" :value="t('import.s_new', { n: preview.summary.new })" />
                    <Tag v-if="preview.summary.add" severity="info" :value="t('import.s_add', { n: preview.summary.add })" />
                    <Tag v-if="preview.summary.skip" severity="secondary" :value="t('import.s_skip', { n: preview.summary.skip })" />
                    <Tag v-if="preview.summary.error" severity="danger" :value="t('import.s_error', { n: preview.summary.error })" />
                </div>
                <DataTable :value="previewRows" size="small" scrollable scrollHeight="18rem">
                    <Column :header="t('import.line')" field="line" style="width: 4rem" />
                    <Column :header="t('fields.name')"><template #body="{ data: r }">{{ r.src.name }}</template></Column>
                    <Column :header="t('fields.mpn')"><template #body="{ data: r }"><span class="mono">{{ r.src.mpn }}</span></template></Column>
                    <Column :header="t('fields.location')"><template #body="{ data: r }">{{ r.src.location }}</template></Column>
                    <Column :header="t('fields.quantity')"><template #body="{ data: r }">{{ r.quantity ?? '' }}</template></Column>
                    <Column :header="t('import.status')">
                        <template #body="{ data: r }"><Tag :severity="STATUS[r.action]" :value="t(`import.a_${r.action}`)" /></template>
                    </Column>
                </DataTable>
            </template>
        </template>

        <template #footer>
            <Button :label="t('common.cancel')" severity="secondary" text @click="visible = false" />
            <Button :label="t('import.run', { n: toImport })" icon="pi pi-upload" :disabled="!toImport" :loading="busy" @click="runImport" />
        </template>
    </Dialog>
</template>

<style scoped>
.intro { margin-top: 0; line-height: 1.5; }
.hidden { display: none; }
.file { gap: .75rem; }
.mt { margin-top: .75rem; }
h4 { margin: 1.2rem 0 .5rem; }
.mapping { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: .5rem .9rem; }
.mapping label { display: flex; flex-direction: column; gap: .2rem; font-size: .88rem; }
.existing { gap: .75rem; margin-top: 1rem; flex-wrap: wrap; }
.summary { gap: .4rem; margin: 1rem 0 .5rem; flex-wrap: wrap; }
</style>
