// =====================================
// i18n.js — FINAL, STABLE
// =====================================

const I18N = {
    currentLang: 'en',
    cache: {},
    translations: {},

    getLanguage() {
        return localStorage.getItem('language') || 'en';
    },

    async loadSection(section) {
        const lang = this.currentLang;
        const cacheKey = `${lang}:${section}`;

        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        const url = `/i18n/${lang}/${section}.json`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[i18n] Missing file: ${url}`);
                return {};
            }

            const data = await res.json();
            this.cache[cacheKey] = data;
            return data;

        } catch (err) {
            console.error('[i18n] Load error:', err);
            return {};
        }
    },

    interpolate(text, params = {}) {
        return text.replace(/\{(\w+)\}/g, (_, key) => {
            return params[key] !== undefined ? params[key] : `{${key}}`;
        });
    },

    async apply(sections = []) {

        if (!Array.isArray(sections)) {
            sections = [sections];
        }
        
        this.currentLang = this.getLanguage();

        const dictionaries = await Promise.all(
            sections.map(section => this.loadSection(section))
        );

        this.translations = Object.assign({}, ...dictionaries);

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const attr = el.getAttribute('data-i18n-attr');
            const paramsRaw = el.getAttribute('data-i18n-params');
        
            if (!this.translations[key]) return;
        
            let text = this.translations[key];
        
            // 🧠 placeholder support
            if (paramsRaw) {
                try {
                    const params = JSON.parse(paramsRaw);
                    text = this.interpolate(text, params);
                } catch (e) {
                    console.warn('[i18n] Invalid params JSON:', paramsRaw);
                }
            }
        
            if (attr) {
                el.setAttribute(attr, text);
            } else {
                el.textContent = text;
            }
        });
        

        document.documentElement.classList.remove('i18n-loading');

        // 🔁 tooltip re-init (posle prevoda)
        if (window.bootstrap) {
            document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                const instance = bootstrap.Tooltip.getInstance(el);
                if (instance) instance.dispose();
                new bootstrap.Tooltip(el);
            });
        }
    },

    t(key) {
        return this.translations?.[key] || key;
    }
};

// ==========================
// PUBLIC API
// ==========================

window.setLanguage = function (lang) {
    localStorage.setItem('language', lang);
    I18N.currentLang = lang;

    window.dispatchEvent(
        new CustomEvent('languageChanged', { detail: { lang } })
    );
};

