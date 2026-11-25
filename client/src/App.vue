<script setup>
// *********************************************************************
// App.vue – okvir aplikacije: navigacija levo, ekran desno,
// bočni panel komponente dostupan sa svakog ekrana
// *********************************************************************
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Button from 'primevue/button';
import ComponentDrawer from './components/ComponentDrawer.vue';
import { store, loadAll, openNewComponent } from './store.js';
import { api } from './api.js';
import { useTheme } from './theme.js';
import { setLocale } from './i18n/index.js';

const { t, locale } = useI18n();
const toast = useToast();
const { isDark, toggleTheme } = useTheme();
const updateAvailable = ref(false);

const nav = [
    { to: '/', icon: 'pi pi-home', label: 'nav.dashboard' },
    { to: '/components', icon: 'pi pi-microchip', label: 'nav.components' },
    { to: '/locations', icon: 'pi pi-map-marker', label: 'nav.locations' },
    { to: '/categories', icon: 'pi pi-tags', label: 'nav.categories' },
    { to: '/settings', icon: 'pi pi-cog', label: 'nav.settings' }
];

// Naslov taba po ekranu: "Komponente – Component Tracker"
const route = useRoute();
watch([() => route.path, locale], () => {
    const item = nav.find(n => n.to === route.path);
    document.title = item && item.to !== '/' ? `${t(item.label)} – Component Tracker` : 'Component Tracker';
}, { immediate: true });

const loadError = ref('');

// Server se možda još pokreće – pokušaj nekoliko puta pre nego što prijaviš grešku
async function initialLoad(attempt = 1) {
    try {
        await loadAll();
        loadError.value = '';
    } catch (e) {
        if (attempt < 6) return setTimeout(() => initialLoad(attempt + 1), 1500);
        loadError.value = e.message;
        toast.add({ severity: 'error', summary: t('common.load_failed'), detail: e.message });
    }
}

onMounted(async () => {
    document.documentElement.lang = locale.value;
    await initialLoad();
    api.system().then(s => (updateAvailable.value = s.update.available)).catch(() => {});
});

const year = new Date().getFullYear();
const toggleLocale =() => setLocale(locale.value === 'sr' ? 'en' : 'sr');
</script>

<template>
    <Toast />
    <ConfirmDialog />

    <div class="shell">
        <nav class="rail">
            <div class="brand">
                <img src="/favicon.svg" alt="mera-system" class="logo" />
                <span class="brand-text">Component<br />Tracker</span>
            </div>

            <!-- tema i jezik: dugme nudi ono NA ŠTA se prelazi -->
            <div class="prefs">
                <Button :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'" :label="t(isDark ? 'settings.theme_light' : 'settings.theme_dark')"
                        text size="small" severity="secondary" @click="toggleTheme" />
                <Button icon="pi pi-globe" :label="locale === 'sr' ? 'English' : 'Srpski'"
                        text size="small" severity="secondary" @click="toggleLocale" />
            </div>

            <Button class="add-btn" icon="pi pi-plus" :label="t('components.new')" @click="openNewComponent" />

            <router-link v-for="n in nav" :key="n.to" :to="n.to" class="nav-item" active-class="" exact-active-class="active">
                <i :class="n.icon" />
                <span>{{ t(n.label) }}</span>
                <span v-if="n.to === '/settings' && updateAvailable" class="dot" v-tooltip.right="t('settings.update_available')" />
            </router-link>

            <a class="copyright" href="https://mera-system.com" target="_blank" rel="noopener">© {{ year }} mera-system</a>
        </nav>

        <main class="main">
            <router-view v-if="store.loaded" />
            <div v-else-if="loadError" class="loading">
                <p>{{ t('common.load_failed') }}: <span class="muted">{{ loadError }}</span></p>
                <Button :label="t('common.retry')" icon="pi pi-refresh" @click="loadError = ''; initialLoad()" />
            </div>
            <div v-else class="loading muted"><i class="pi pi-spin pi-spinner" /> {{ t('common.loading') }}</div>
        </main>
    </div>

    <ComponentDrawer />
</template>

<style scoped>
.shell { display: grid; grid-template-columns: 13rem minmax(0, 1fr); height: 100vh; }
.rail {
    display: flex; flex-direction: column; gap: .2rem; padding: .9rem .6rem;
    background: var(--p-content-background); border-right: 1px solid var(--p-content-border-color);
}
.brand { display: flex; align-items: center; gap: .6rem; padding: 0 .5rem .9rem; font-weight: 700; line-height: 1.1; }
.brand .logo { width: 2rem; height: 2rem; flex-shrink: 0; }
.copyright {
    display: block; text-align: center; margin-top: auto; font-size: .78rem;
    color: var(--p-text-muted-color); text-decoration: none;
}
.copyright:hover { color: var(--p-primary-color); }
.add-btn { margin: 0 .1rem .75rem; white-space: nowrap; }
.nav-item {
    display: flex; align-items: center; gap: .7rem; padding: .6rem .75rem; border-radius: 8px;
    color: var(--p-text-color); text-decoration: none; position: relative;
}
.nav-item:hover { background: var(--p-content-hover-background); }
.nav-item.active { background: var(--p-highlight-background); color: var(--p-highlight-color); font-weight: 600; }
.nav-item i { width: 1.1rem; text-align: center; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--p-orange-500); margin-left: auto; }
.prefs { display: grid; grid-template-columns: 1fr 1fr; gap: .25rem; margin: 0 0 .9rem; }
.prefs :deep(.p-button) { padding: .45rem .4rem; font-size: .9rem; color: var(--p-text-color); }
.main { overflow: auto; min-width: 0; }
.loading { padding: 3rem; text-align: center; }

/* telefon / usko: navigacija ide na dno ekrana */
@media (max-width: 760px) {
    .shell { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; }
    .main { grid-row: 1; }
    .rail {
        grid-row: 2; flex-direction: row; justify-content: space-around; align-items: center;
        padding: .3rem; border-right: 0; border-top: 1px solid var(--p-content-border-color);
    }
    .brand, .prefs, .copyright { display: none; }
    .add-btn { margin: 0; }
    .add-btn :deep(.p-button-label) { display: none; }
    .nav-item { flex-direction: column; gap: .15rem; padding: .35rem .4rem; font-size: .78rem; }
    .dot { position: absolute; top: 4px; right: 8px; }
}
</style>
