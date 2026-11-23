// Tema: light | dark | system (pamti se u ovom browseru)
import { ref, computed } from 'vue';

const mode = ref(read());
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const systemIsDark = ref(systemDark.matches);
systemDark.addEventListener('change', e => { systemIsDark.value = e.matches; apply(); });

function read() {
    try { return localStorage.getItem('theme') || 'system'; } catch { return 'system'; }
}

const isDark = computed(() => mode.value === 'dark' || (mode.value === 'system' && systemIsDark.value));

function apply() {
    document.documentElement.classList.toggle('app-dark', isDark.value);
}

function setTheme(value) {
    mode.value = value;
    try { localStorage.setItem('theme', value); } catch { /* ignore */ }
    apply();
}

export function useTheme() {
    return {
        mode,
        isDark,
        setTheme,
        toggleTheme: () => setTheme(isDark.value ? 'light' : 'dark')
    };
}

// Veličina teksta: small | normal | large (pamti se u ovom browseru).
// Sve dimenzije u aplikaciji su u rem, pa se cela aplikacija srazmerno uvećava.
export const TEXT_SIZES = { small: 14, normal: 16, large: 18 };
const textSize = ref(readSize());

function readSize() {
    try { const s = localStorage.getItem('textSize'); return s in TEXT_SIZES ? s : 'normal'; } catch { return 'normal'; }
}

function applySize() {
    document.documentElement.style.fontSize = `${TEXT_SIZES[textSize.value]}px`;
}
applySize();

export function useTextSize() {
    return {
        textSize,
        setTextSize(value) {
            textSize.value = value;
            try { localStorage.setItem('textSize', value); } catch { /* ignore */ }
            applySize();
        }
    };
}
