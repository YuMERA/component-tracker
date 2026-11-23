<script setup>
// Pregled: brojevi, poslednje dodate, kritične zalihe, poslednje promene stanja
import { computed, ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Tag from 'primevue/tag';
import { api } from '../api.js';
import { store, openComponent, stockStatus, imageSrc } from '../store.js';

const { t, d } = useI18n();
const movements = ref([]);

const loadMovements = async () => (movements.value = await api.movements(12));
onMounted(loadMovements);
// osveži aktivnost kad se nešto promeni u listi
watch(() => store.components, loadMovements, { deep: true });

const stats = computed(() => {
    const s = { unique: store.components.length, total: 0, low: 0, out: 0 };
    for (const c of store.components) {
        s.total += c.quantity;
        const k = stockStatus(c).key;
        if (k === 'low') s.low++;
        if (k === 'out') s.out++;
    }
    return s;
});

const cards = computed(() => [
    { key: 'unique', icon: 'pi pi-microchip', value: stats.value.unique, to: '/components' },
    { key: 'total', icon: 'pi pi-box', value: stats.value.total, to: '/components' },
    { key: 'categories', icon: 'pi pi-tags', value: store.categories.length, to: '/categories' },
    { key: 'locations', icon: 'pi pi-map-marker', value: store.locations.length, to: '/locations' },
    { key: 'low', icon: 'pi pi-exclamation-circle', value: stats.value.low, to: '/components?status=low', tone: stats.value.low ? 'warn' : '' },
    { key: 'out', icon: 'pi pi-ban', value: stats.value.out, to: '/components?status=out', tone: stats.value.out ? 'danger' : '' }
]);

const recent = computed(() => [...store.components].sort((a, b) => b.id - a.id).slice(0, 6));
const critical = computed(() => store.components
    .filter(c => stockStatus(c).key !== 'ok')
    .sort((a, b) => (a.quantity - a.min_stock) - (b.quantity - b.min_stock))
    .slice(0, 6));

const fmtDate = (s, f = 'short') => d(new Date(s.replace(' ', 'T') + 'Z'), f);
</script>

<template>
    <div class="page">
        <div class="page-head"><h1>{{ t('nav.dashboard') }}</h1></div>

        <div class="cards">
            <router-link v-for="c in cards" :key="c.key" :to="c.to" class="card stat" :class="c.tone">
                <i :class="c.icon" />
                <div>
                    <div class="value num">{{ c.value.toLocaleString() }}</div>
                    <div class="muted">{{ t(`dashboard.${c.key}`) }}</div>
                </div>
            </router-link>
        </div>

        <div class="grid">
            <section class="card card-pad">
                <h3>{{ t('dashboard.recent') }}</h3>
                <div v-for="c in recent" :key="c.id" class="item" @click="openComponent(c.id)">
                    <div class="thumb"><img v-if="imageSrc(c)" :src="imageSrc(c)" alt="" /><i v-else class="pi pi-microchip" /></div>
                    <div class="grow">
                        <div class="ellipsis"><strong>{{ c.name }}</strong></div>
                        <div class="muted small ellipsis">{{ c.category || '—' }} · {{ fmtDate(c.created_at, 'date') }}</div>
                    </div>
                    <span class="num">{{ c.quantity }}</span>
                </div>
                <p v-if="!recent.length" class="muted">{{ t('dashboard.empty') }}</p>
            </section>

            <section class="card card-pad">
                <h3>{{ t('dashboard.critical') }}</h3>
                <div v-for="c in critical" :key="c.id" class="item" @click="openComponent(c.id)">
                    <div class="thumb"><img v-if="imageSrc(c)" :src="imageSrc(c)" alt="" /><i v-else class="pi pi-microchip" /></div>
                    <div class="grow">
                        <div class="ellipsis"><strong>{{ c.name }}</strong></div>
                        <div class="muted small">{{ t('dashboard.min', { n: c.min_stock }) }}</div>
                    </div>
                    <Tag :value="String(c.quantity)" :severity="stockStatus(c).severity" />
                </div>
                <p v-if="!critical.length" class="muted"><i class="pi pi-check-circle" /> {{ t('dashboard.all_ok') }}</p>
            </section>

            <section class="card card-pad">
                <h3>{{ t('dashboard.activity') }}</h3>
                <div v-for="m in movements" :key="m.id" class="item" @click="openComponent(m.component_id)">
                    <Tag :value="(m.delta > 0 ? '+' : '') + m.delta" :severity="m.delta > 0 ? 'success' : 'danger'" class="mono delta" />
                    <div class="grow">
                        <div class="ellipsis"><strong>{{ m.component_name }}</strong></div>
                        <div class="muted small ellipsis">{{ t(`movement.${m.kind}`) }} · {{ m.location || t('filters.no_location') }}</div>
                    </div>
                    <span class="muted small">{{ fmtDate(m.created_at) }}</span>
                </div>
                <p v-if="!movements.length" class="muted">{{ t('drawer.no_history') }}</p>
            </section>
        </div>
    </div>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: .75rem; }
.stat { display: flex; align-items: center; gap: .9rem; padding: .9rem 1rem; text-decoration: none; color: inherit; }
.stat:hover { border-color: var(--p-primary-color); }
.stat i { font-size: 1.4rem; color: var(--p-primary-color); }
.stat.warn i { color: var(--p-orange-500); }
.stat.danger i { color: var(--p-red-500); }
.value { font-size: 1.5rem; font-weight: 700; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1rem; }
.item { display: flex; align-items: center; gap: .7rem; padding: .45rem .3rem; border-radius: 6px; cursor: pointer; }
.item:hover { background: var(--p-content-hover-background); }
.small { font-size: .82rem; }
.delta { min-width: 3.2rem; justify-content: center; }
</style>
