import { createI18n } from 'vue-i18n';
import sr from './sr.json';
import en from './en.json';

function initialLocale() {
    try {
        const saved = localStorage.getItem('locale');
        if (saved === 'sr' || saved === 'en') return saved;
    } catch { /* privatni prozor */ }
    return navigator.language?.startsWith('sr') || navigator.language?.startsWith('hr') || navigator.language?.startsWith('bs') ? 'sr' : 'en';
}

export const i18n = createI18n({
    legacy: false,
    locale: initialLocale(),
    fallbackLocale: 'en',
    messages: { sr, en },
    datetimeFormats: Object.fromEntries(['sr', 'en'].map(l => [l, {
        short: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
        date: { year: 'numeric', month: '2-digit', day: '2-digit' }
    }])),
    numberFormats: Object.fromEntries(['sr', 'en'].map(l => [l, { integer: { maximumFractionDigits: 0 } }]))
});

export function setLocale(locale) {
    i18n.global.locale.value = locale;
    document.documentElement.lang = locale;
    try { localStorage.setItem('locale', locale); } catch { /* ignore */ }
}
