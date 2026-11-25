<script setup>
// Filteri sa brojačima. v-model = { q, status, categories: [], locations: [] }
// Vrednosti su id-jevi, a 'none' znači "bez kategorije / bez lokacije".
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { store, stockStatus } from '../store.js';

const { t } = useI18n();
const filters = defineModel({ required: true });

const statusCounts = computed(() => {
    const s = { all: store.components.length, ok: 0, low: 0, out: 0 };
    for (const c of store.components) s[stockStatus(c).key]++;
    return s;
});

const categoryItems = computed(() => {
    const counts = new Map();
    for (const c of store.components) counts.set(c.category_id ?? 'none', (counts.get(c.category_id ?? 'none') || 0) + 1);
    const items = store.categories
        .map(cat => ({ id: cat.id, name: cat.name, count: counts.get(cat.id) || 0 }))
        .filter(i => i.count);
    if (counts.get('none')) items.push({ id: 'none', name: t('filters.no_category'), count: counts.get('none'), muted: true });
    return items;
});

// Lokacije kao stablo (uvučeno po dubini); broj uključuje i podlokacije
const locationItems = computed(() => {
    const direct = new Map();
    let none = 0;
    for (const c of store.components) {
        if (!c.stock.some(s => s.location_id)) none++;
        for (const s of c.stock) if (s.location_id) direct.set(s.location_id, (direct.get(s.location_id) || new Set()).add(c.id));
    }
    const childrenOf = id => store.locations.filter(l => l.parent_id === id);
    const collect = (id, acc) => {
        for (const cid of direct.get(id) || []) acc.add(cid);
        for (const ch of childrenOf(id)) collect(ch.id, acc);
        return acc;
    };
    const items = store.locations.map(l => ({ id: l.id, name: l.name, depth: l.depth, count: collect(l.id, new Set()).size }));
    if (none) items.push({ id: 'none', name: t('filters.no_location'), depth: 0, count: none, muted: true });
    return items;
});

const statuses = [
    { key: 'all', icon: 'pi pi-list' },
    { key: 'low', icon: 'pi pi-exclamation-circle' },
    { key: 'out', icon: 'pi pi-ban' }
];

function toggle(list, id) {
    const arr = filters.value[list];
    const i = arr.indexOf(id);
    i >= 0 ? arr.splice(i, 1) : arr.push(id);
}

const activeCount = computed(() =>
    filters.value.categories.length + filters.value.locations.length + (filters.value.status !== 'all' ? 1 : 0));

function reset() {
    Object.assign(filters.value, { status: 'all', categories: [], locations: [] });
}
</script>

<template>
    <aside class="card panel">
        <div class="head">
            <strong>{{ t('filters.title') }}</strong>
            <a v-if="activeCount" href="#" @click.prevent="reset">{{ t('filters.reset', { n: activeCount }) }}</a>
        </div>

        <h4>{{ t('filters.stock') }}</h4>
        <button v-for="s in statuses" :key="s.key" class="item" :class="{ active: filters.status === s.key }"
                @click="filters.status = s.key">
            <i :class="s.icon" /> <span class="grow">{{ t(`status.${s.key}`) }}</span>
            <span class="count">{{ statusCounts[s.key] }}</span>
        </button>

        <h4>{{ t('nav.categories') }}</h4>
        <button v-for="c in categoryItems" :key="c.id" class="item" :class="{ active: filters.categories.includes(c.id), muted: c.muted }"
                @click="toggle('categories', c.id)">
            <span class="grow name">{{ c.name }}</span> <span class="count">{{ c.count }}</span>
        </button>

        <h4>{{ t('nav.locations') }}</h4>
        <button v-for="l in locationItems" :key="l.id" class="item" :class="{ active: filters.locations.includes(l.id), muted: l.muted }"
                :style="{ paddingLeft: `${0.5 + l.depth * 0.9}rem` }" @click="toggle('locations', l.id)">
            <i :class="l.depth ? 'pi pi-angle-right' : 'pi pi-map-marker'" />
            <span class="grow name">{{ l.name }}</span> <span class="count">{{ l.count }}</span>
        </button>
    </aside>
</template>

<style scoped>
.panel { padding: .75rem; }
/* naslov i Reset ostaju na vrhu dok se lista filtera skroluje */
.head {
    display: flex; justify-content: space-between; align-items: center;
    position: sticky; top: -.75rem; z-index: 1;
    margin: -.75rem -.75rem 0; padding: .75rem;
    background: var(--p-content-background); border-bottom: 1px solid var(--p-content-border-color);
}
.head a { font-size: .85rem; text-decoration: none; }
h4 { margin: 1rem 0 .35rem; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; color: var(--p-text-muted-color); }
.item {
    display: flex; align-items: center; gap: .5rem; width: 100%;
    padding: .38rem .5rem; border: 0; border-radius: 6px; background: transparent;
    color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.item:hover { background: var(--p-content-hover-background); }
.item.active { background: var(--p-highlight-background); color: var(--p-highlight-color); font-weight: 600; }
.item.muted { font-style: italic; }
.item i { font-size: .8rem; opacity: .7; }
/* dugački nazivi idu u novi red umesto da se skraćuju */
.name { overflow-wrap: anywhere; line-height: 1.3; }
.count { font-size: .8rem; color: var(--p-text-muted-color); }
</style>
