import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css';
import './style.css';
import App from './App.vue';
import { router } from './router.js';
import { i18n } from './i18n/index.js';

createApp(App)
    .use(PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } })
    .use(ToastService)
    .use(ConfirmationService)
    .use(router)
    .use(i18n)
    .directive('tooltip', Tooltip)
    .mount('#app');
