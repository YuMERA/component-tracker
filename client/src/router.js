import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from './views/DashboardView.vue';
import ComponentsView from './views/ComponentsView.vue';
import LocationsView from './views/LocationsView.vue';
import CategoriesView from './views/CategoriesView.vue';
import SettingsView from './views/SettingsView.vue';
import TrashView from './views/TrashView.vue';
import GuideView from './views/GuideView.vue';

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', name: 'dashboard', component: DashboardView },
        { path: '/components', name: 'components', component: ComponentsView },
        { path: '/locations', name: 'locations', component: LocationsView },
        { path: '/categories', name: 'categories', component: CategoriesView },
        { path: '/trash', name: 'trash', component: TrashView },
        { path: '/guide', name: 'guide', component: GuideView },
        { path: '/settings', name: 'settings', component: SettingsView },
        { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
});
