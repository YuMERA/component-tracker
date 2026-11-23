<script setup>
// Stanje u listi: +/- direktno. Ako je komponenta na više lokacija,
// klik na broj otvara mali prozor sa +/- za svaku lokaciju.
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Tag from 'primevue/tag';
import { api } from '../api.js';
import { putComponent, stockStatus } from '../store.js';

const props = defineProps({ component: { type: Object, required: true } });
const { t } = useI18n();
const toast = useToast();
const pop = ref();
const busy = ref(false);

async function adjust(row, delta, event) {
    if (event?.shiftKey) delta *= 10;           // Shift + klik = ±10
    if (busy.value || (row?.quantity ?? 0) + delta < 0) return;
    busy.value = true;
    // odmah prikaži (optimistično), pa uskladi sa serverom
    if (row) row.quantity += delta;
    props.component.quantity += delta;
    try {
        putComponent(await api.adjust(props.component.id, { location_id: row?.location_id ?? null, delta }));
    } catch (e) {
        if (row) row.quantity -= delta;
        props.component.quantity -= delta;
        toast.add({ severity: 'error', summary: t('stock.not_changed'), detail: e.message, life: 4000 });
    } finally {
        busy.value = false;
    }
}

const multi = () => props.component.stock.length > 1;
const single = () => props.component.stock[0] || null;
</script>

<template>
    <div class="qty" @click.stop>
        <template v-if="!multi()">
            <Button icon="pi pi-minus" size="small" text rounded severity="secondary"
                    :disabled="component.quantity <= 0" @click="adjust(single(), -1, $event)" v-tooltip="t('stock.minus_hint')" />
            <span class="value num">{{ component.quantity }}</span>
            <Button icon="pi pi-plus" size="small" text rounded severity="secondary"
                    @click="adjust(single(), 1, $event)" v-tooltip="t('stock.plus_hint')" />
        </template>
        <button v-else class="multi" @click="pop.toggle($event)" v-tooltip="t('stock.per_location')">
            <span class="value num">{{ component.quantity }}</span>
            <i class="pi pi-sitemap" /> {{ component.stock.length }}
        </button>
        <Tag v-if="stockStatus(component).key !== 'ok'" :value="t(`status.short_${stockStatus(component).key}`)"
             :severity="stockStatus(component).severity" />

        <Popover ref="pop">
            <div class="pop">
                <div class="pop-title">{{ component.name }}</div>
                <div v-for="s in component.stock" :key="s.id" class="pop-row">
                    <i class="pi pi-map-marker muted" />
                    <span class="grow ellipsis">{{ s.location || t('filters.no_location') }}</span>
                    <Button icon="pi pi-minus" size="small" text rounded severity="secondary" :disabled="s.quantity <= 0" @click="adjust(s, -1, $event)" />
                    <span class="value num">{{ s.quantity }}</span>
                    <Button icon="pi pi-plus" size="small" text rounded severity="secondary" @click="adjust(s, 1, $event)" />
                </div>
            </div>
        </Popover>
    </div>
</template>

<style scoped>
.qty { display: flex; align-items: center; gap: .15rem; }
.value { min-width: 2.4rem; text-align: center; font-weight: 600; }
.multi {
    display: flex; align-items: center; gap: .3rem; padding: .25rem .5rem; margin: 0 .3rem;
    border: 1px dashed var(--p-content-border-color); border-radius: 6px;
    background: transparent; color: inherit; font: inherit; cursor: pointer;
}
.multi i { font-size: .75rem; color: var(--p-text-muted-color); }
.multi:hover { border-color: var(--p-primary-color); }
.pop { min-width: 18rem; }
.pop-title { font-weight: 700; margin-bottom: .4rem; }
.pop-row { display: flex; align-items: center; gap: .3rem; padding: .15rem 0; }
</style>
