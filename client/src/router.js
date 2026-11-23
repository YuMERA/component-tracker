import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from './views/DashboardView.vue';
import ComponentsView from './views/ComponentsView.vue';
import LocationsView from './views/LocationsView.vue';
import CategoriesView from './views/CategoriesView.vue';
import SettingsView from './views/SettingsView.vue';

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', name: 'dashboard', component: DashboardView },
        { path: '/components', name: 'components', component: ComponentsView },
        { path: '/locations', name: 'locations', component: LocationsView },
        { path: '/categories', name: 'categories', component: CategoriesView },
        { path: '/settings', name: 'settings', component: SettingsView },
        { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
});
