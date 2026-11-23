<script setup>
// *********************************************************************
// Lookup u dva koraka:
//   1) pretraga → tabela kandidata grupisanih po "porodici" (varijante)
//   2) pregled: trenutna vs nova vrednost, biraš koja polja se prepisuju
// *********************************************************************
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Checkbox from 'primevue/checkbox';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { api } from '../api.js';
import { store } from '../store.js';

const visible = defineModel('visible', { type: Boolean });
const props = defineProps({ query: String, current: Object, isNew: Boolean });
const emit = defineEmits(['apply', 'open-existing']);
const { t, locale } = useI18n();
const router = useRouter();

const q = ref('');
const mode = ref('begins');
const modes = computed(() => [
    { label: t('lookup.mode_exact'), value: 'exact' },
    { label: t('lookup.mode_begins'), value: 'begins' },
    { label: t('lookup.mode_keyword'), value: 'keyword' }
]);

const loading = ref(false);
const result = ref(null);
const error = ref('');
const picked = ref(null);
const fieldRows = ref([]);

watch(visible, open => {
    if (!open) return;
    q.value = props.query || '';
    picked.value = null;
    if (q.value.length >= 2) search();
});

async function search() {
    if (q.value.trim().length < 2) return;
    loading.value = true;
    error.value = '';
    picked.value = null;
    try {
        result.value = await api.lookup(q.value.trim(), mode.value);
    } catch (e) {
        error.value = e.message;
        result.value = null;
    } finally {
        loading.value = false;
    }
}

const candidates = computed(() => result.value?.candidates || []);
const noServices = computed(() => result.value && !result.value.sources.length);
const familySize = computed(() => {
    const m = {};
    for (const c of candidates.value) m[c.family] = (m[c.family] || 0) + 1;
    return m;
});

const lifecycleSeverity = s => /obsolete|end of life|eol|not recommended|nrnd/i.test(s || '') ? 'danger'
    : /active/i.test(s || '') ? 'success' : 'secondary';

// --- Korak 2: mapiranje polja ----------------------------------------
const FIELDS = [
    { key: 'name', from: c => c.mpn },
    { key: 'mpn', from: c => c.mpn },
    { key: 'manufacturer', from: c => c.manufacturer },
    { key: 'package', from: c => c.package },
    { key: 'category', from: c => store.categories.find(x => x.name.toLowerCase() === (c.category || '').toLowerCase())?.name },
    { key: 'description', from: c => c.description },
    { key: 'image_url', from: c => c.image_url },
    { key: 'datasheet_url', from: c => c.datasheet_url }
    // parametri se namerno ne preuzimaju iz kataloga (nepouzdani) – vidi server/providers/normalize.js
];

const show = v => v ?? '';

function pick(c) {
    picked.value = c;
    fieldRows.value = FIELDS
        .map(f => ({ ...f, old: props.current?.[f.key], value: f.from(c) }))
        .filter(f => f.value != null && f.value !== '')
        .map(f => {
            const same = JSON.stringify(f.old ?? '') === JSON.stringify(f.value);
            // podrazumevano: popuni prazna polja; postojeće vrednosti ne diramo dok ih ne štikliraš
            return { ...f, same, use: !same && (props.isNew || !show(f.old)) };
        });
}

function apply() {
    const out = {};
    for (const f of fieldRows.value) if (f.use) out[f.key] = Array.isArray(f.value) ? f.value.map(p => ({ ...p })) : f.value;
    emit('apply', out);
    visible.value = false;
}

function openSettings() {
    visible.value = false;
    router.push('/settings');
}

const selectedCount = computed(() => fieldRows.value.filter(f => f.use).length);
const fmt = n => (n == null ? '?' : Number(n).toLocaleString(locale.value));
</script>

<template>
    <Dialog v-model:visible="visible" modal :header="picked ? t('lookup.step2_title') : t('lookup.title')"
            :style="{ width: 'min(74rem, 96vw)' }" :contentStyle="{ minHeight: '24rem' }" maximizable>

        <!-- KORAK 1: PRETRAGA ------------------------------------------>
        <template v-if="!picked">
            <form class="searchbar" @submit.prevent="search">
                <InputText v-model="q" :placeholder="t('lookup.placeholder')" class="grow mono" autofocus />
                <SelectButton v-model="mode" :options="modes" optionLabel="label" optionValue="value" :allowEmpty="false" />
                <Button type="submit" :label="t('lookup.search')" icon="pi pi-search" :loading="loading" />
            </form>

            <Message v-if="noServices" severity="warn">
                {{ t('lookup.no_services') }}
                <Button :label="t('nav.settings')" link size="small" @click="openSettings" />
            </Message>

            <div v-if="result && !noServices" class="sources">
                <Tag v-for="s in result.sources" :key="s.name"
                     :severity="s.ok ? 'secondary' : 'danger'"
                     :icon="s.ok ? 'pi pi-check' : 'pi pi-times'"
                     :value="s.ok ? `${s.name}: ${s.count}` : `${s.name}: ${t('common.error')}`"
                     v-tooltip="s.error" />
                <span class="muted">{{ t('lookup.summary', { n: candidates.length }) }}</span>
            </div>
            <Message v-if="error" severity="error">{{ error }}</Message>

            <DataTable v-if="result && !noServices" :value="candidates" :loading="loading" dataKey="key" size="small" rowHover
                       rowGroupMode="subheader" groupRowsBy="family" scrollable scrollHeight="55vh"
                       @row-click="e => pick(e.data)" class="candidates"
                       :pt="{ rowGroupHeaderCell: { colspan: 6 } }"><!-- PrimeVue daje kolona−1 (očekuje skrivenu kolonu grupe); 6 = sve kolone -->
                <template #empty><div class="muted empty">{{ t('lookup.empty') }}</div></template>

                <template #groupheader="{ data }">
                    <div class="group">
                        <i class="pi pi-sitemap" />
                        <strong class="mono">{{ data.family }}</strong>
                        <span v-if="familySize[data.family] > 1" class="muted">{{ t('lookup.variants', { n: familySize[data.family] }) }}</span>
                    </div>
                </template>

                <Column style="width: 56px">
                    <template #body="{ data }">
                        <div class="thumb">
                            <img v-if="data.image_url" :src="data.image_url" alt="" loading="lazy" />
                            <i v-else class="pi pi-image" />
                        </div>
                    </template>
                </Column>
                <Column :header="t('lookup.col_mpn')" style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="row" style="gap:.35rem;flex-wrap:wrap">
                            <strong class="mono">{{ data.mpn }}</strong>
                            <Tag v-if="data.exact" :value="t('lookup.exact_match')" severity="info" />
                        </div>
                        <div class="muted">{{ data.manufacturer }}</div>
                        <Tag v-if="data.in_inventory" severity="warn" icon="pi pi-box" class="inv"
                             :value="t('lookup.in_inventory', { n: data.in_inventory.quantity })"
                             @click.stop="emit('open-existing', data.in_inventory.id)" v-tooltip="t('lookup.open_in_inventory')" />
                    </template>
                </Column>
                <Column :header="t('fields.package')" style="min-width: 8rem">
                    <template #body="{ data }">
                        <strong class="mono" :class="{ muted: data.package_inferred }"
                                v-tooltip="data.package_inferred ? t('lookup.package_inferred') : null">
                            {{ data.package || '—' }}<template v-if="data.package_inferred">*</template>
                        </strong>
                    </template>
                </Column>
                <Column :header="t('fields.description')" style="min-width: 18rem">
                    <template #body="{ data }"><div class="desc">{{ data.description }}</div></template>
                </Column>
                <Column :header="t('lookup.col_status')" style="min-width: 7rem">
                    <template #body="{ data }">
                        <Tag v-if="data.lifecycle" :value="data.lifecycle" :severity="lifecycleSeverity(data.lifecycle)" />
                    </template>
                </Column>
                <Column :header="t('lookup.col_sources')" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div v-for="s in data.sources" :key="s.name" class="src">
                            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" @click.stop>{{ s.name }}</a>
                            <span v-else>{{ s.name }}</span>
                            <span class="muted mono">{{ fmt(s.stock) }}</span>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </template>

        <!-- KORAK 2: PREGLED PRE PREUZIMANJA --------------------------->
        <template v-else>
            <div class="picked">
                <div class="thumb big"><img v-if="picked.image_url" :src="picked.image_url" alt="" /></div>
                <div>
                    <strong class="mono">{{ picked.mpn }}</strong>
                    <div class="muted">{{ picked.manufacturer }} · {{ picked.package || t('lookup.package_unknown') }}</div>
                </div>
            </div>
            <p class="muted">{{ t('lookup.step2_hint') }}</p>

            <table class="diff">
                <thead><tr><th></th><th>{{ t('lookup.col_field') }}</th><th>{{ t('lookup.col_current') }}</th><th>{{ t('lookup.col_catalog') }}</th></tr></thead>
                <tbody>
                    <tr v-for="f in fieldRows" :key="f.key" :class="{ off: !f.use }" @click="!f.same && (f.use = !f.use)">
                        <td><Checkbox v-model="f.use" binary :disabled="f.same" @click.stop /></td>
                        <th>{{ t(`fields.${f.key}`) }}</th>
                        <td class="val muted">{{ show(f.old) || '—' }}</td>
                        <td class="val">
                            <Tag v-if="f.same" :value="t('lookup.same')" severity="secondary" />
                            <template v-else>{{ show(f.value) }}</template>
                        </td>
                    </tr>
                </tbody>
            </table>
        </template>

        <template #footer>
            <template v-if="picked">
                <Button :label="t('lookup.back')" icon="pi pi-arrow-left" severity="secondary" text @click="picked = null" />
                <Button :label="t('lookup.apply', { n: selectedCount })" icon="pi pi-download" :disabled="!selectedCount" @click="apply" />
            </template>
            <Button v-else :label="t('common.close')" severity="secondary" text @click="visible = false" />
        </template>
    </Dialog>
</template>

<style scoped>
.searchbar { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: .75rem; }
.searchbar .grow { min-width: 14rem; }
.sources { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-bottom: .75rem; }
.group { display: flex; gap: .6rem; align-items: center; }
.desc { white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; font-size: .9em; }
.src { display: flex; justify-content: space-between; gap: .75rem; }
.inv { margin-top: .3rem; cursor: pointer; }
.empty { padding: 1.5rem; text-align: center; }
.candidates :deep(tbody tr:not(.p-datatable-row-group-header)) { cursor: pointer; }
/* zaglavlje porodice (TL072CPS, TL072CPW…) – obojeno da se odvoji od varijanti ispod */
.candidates :deep(tr.p-datatable-row-group-header),
.candidates :deep(tr.p-datatable-row-group-header > td) {
    background: color-mix(in srgb, var(--p-primary-color) 12%, var(--p-content-background));
}
.candidates :deep(tr.p-datatable-row-group-header > td) { border-top: 2px solid color-mix(in srgb, var(--p-primary-color) 35%, transparent); }
.group .pi-sitemap { color: var(--p-primary-color); }
.picked { display: flex; gap: .75rem; align-items: center; margin-bottom: .5rem; }
.thumb.big { width: 64px; height: 64px; }
.diff { width: 100%; border-collapse: collapse; }
.diff th, .diff td { padding: .5rem; border-bottom: 1px solid var(--p-content-border-color); text-align: left; vertical-align: top; }
.diff thead th { font-size: .8rem; color: var(--p-text-muted-color); }
.diff tbody tr { cursor: pointer; }
.diff tbody tr.off .val:last-child { opacity: .5; }
.diff .val { white-space: pre-line; word-break: break-word; max-width: 26rem; }</style>
