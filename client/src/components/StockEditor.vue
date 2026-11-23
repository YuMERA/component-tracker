<script setup>
// Stanje po lokacijama u formi: [{ location: 'Ormar A › Fioka 1' | null, quantity }]
// Lokacija se bira iz liste ili upisuje nova (› ili / pravi podlokaciju).
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AutoComplete from 'primevue/autocomplete';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import { store } from '../store.js';

const rows = defineModel({ type: Array, required: true });
const { t } = useI18n();

const suggestions = ref([]);
const allPaths = computed(() => store.locations.map(l => l.path));

function search(e) {
    const q = (e.query || '').toLowerCase();
    suggestions.value = allPaths.value.filter(p => p.toLowerCase().includes(q));
}

const total = computed(() => rows.value.reduce((s, r) => s + (r.quantity || 0), 0));
const add = () => rows.value.push({ location: null, quantity: 0 });
const remove = i => rows.value.splice(i, 1);
</script>

<template>
    <div class="stock">
        <div v-for="(r, i) in rows" :key="i" class="stock-row">
            <AutoComplete v-model="r.location" :suggestions="suggestions" dropdown completeOnFocus
                          :placeholder="t('stock.no_location')" class="loc" fluid @complete="search" />
            <InputNumber v-model="r.quantity" :min="0" showButtons buttonLayout="horizontal" class="qty"
                         incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus" inputClass="num" />
            <Button icon="pi pi-trash" text rounded severity="secondary" :disabled="rows.length === 1"
                    @click="remove(i)" v-tooltip="t('stock.remove_location')" />
        </div>
        <div class="stock-foot">
            <Button :label="t('stock.add_location')" icon="pi pi-plus" text size="small" @click="add" />
            <span v-if="rows.length > 1" class="muted">{{ t('stock.total') }}: <strong class="num">{{ total }}</strong></span>
        </div>
    </div>
</template>

<style scoped>
.stock { display: flex; flex-direction: column; gap: .4rem; }
.stock-row { display: flex; gap: .5rem; align-items: center; }
.loc { flex: 1; min-width: 0; }
.qty { width: 9.5rem; flex-shrink: 0; }
.qty :deep(input) { text-align: center; width: 100%; }
.stock-foot { display: flex; justify-content: space-between; align-items: center; }
</style>
