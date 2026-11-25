<script setup>
// *********************************************************************
// Uputstvo: poglavlja sa slikama ekrana. Sadržaj je u guide/content.js,
// slike u public/guide-shots/<jezik>/ (npm run guide:screens).
// *********************************************************************
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import Image from 'primevue/image';
import { GUIDE } from '../guide/content.js';

const { t, locale } = useI18n();
const route = useRoute();
const sections = computed(() => GUIDE[locale.value] || GUIDE.en);
const imgSrc = name => `/guide-shots/${locale.value}/${name}.webp`;
const active = ref('');
const content = ref(null);

// Sadržaj levo prati poglavlje koje se trenutno čita
let observer;
onMounted(async () => {
    await nextTick();
    observer = new IntersectionObserver(entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) active.value = visible[0].target.id;
    }, { root: null, rootMargin: '0px 0px -70% 0px' });
    content.value?.querySelectorAll('section[id]').forEach(s => observer.observe(s));
    if (route.hash) document.querySelector(route.hash)?.scrollIntoView();
});
onBeforeUnmount(() => observer?.disconnect());

function go(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
}

// Linkovi "#poglavlje" unutar teksta skroluju na poglavlje (umesto da menjaju stranicu)
function onContentClick(e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute('href').slice(1));
}
</script>

<template>
    <div class="page guide">
        <div class="page-head"><h1>{{ t('nav.guide') }}</h1></div>

        <div class="layout">
            <nav class="toc card card-pad">
                <a v-for="(s, i) in sections" :key="s.id" :href="`#${s.id}`" :class="{ active: active === s.id }"
                   @click.prevent="go(s.id)">
                    <span class="num">{{ i + 1 }}</span> {{ s.title }}
                </a>
            </nav>

            <div ref="content" class="content" @click="onContentClick">
                <section v-for="(s, i) in sections" :id="s.id" :key="s.id" class="card card-pad chapter">
                    <h2><span class="num">{{ i + 1 }}</span> {{ s.title }}</h2>
                    <div class="text" v-html="s.html" />
                    <figure>
                        <Image :src="imgSrc(s.img)" :alt="s.caption" preview imageClass="shot" />
                        <figcaption>{{ s.caption }}</figcaption>
                    </figure>
                    <figure v-if="s.extraImg" :class="{ phone: s.extraPhone }">
                        <Image :src="imgSrc(s.extraImg)" :alt="s.extraCaption" preview imageClass="shot" />
                        <figcaption>{{ s.extraCaption }}</figcaption>
                    </figure>
                </section>
                <p class="muted hint"><i class="pi pi-search-plus" /> {{ t('guide.zoom_hint') }}</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 15rem minmax(0, 1fr); gap: 1rem; align-items: start; }
.toc { position: sticky; top: 0; display: flex; flex-direction: column; gap: .1rem; }
.toc a {
    display: flex; gap: .5rem; align-items: baseline; padding: .4rem .5rem; border-radius: 6px;
    color: var(--p-text-color); text-decoration: none; font-size: .92rem; line-height: 1.3;
}
.toc a:hover { background: var(--p-content-hover-background); }
.toc a.active { background: var(--p-highlight-background); color: var(--p-highlight-color); font-weight: 600; }
.num { color: var(--p-primary-color); font-weight: 700; min-width: 1.2rem; }
.content { display: flex; flex-direction: column; gap: 1rem; max-width: 62rem; }
.chapter { scroll-margin-top: 1rem; }
.chapter h2 { margin: 0 0 .75rem; font-size: 1.3rem; display: flex; gap: .5rem; }
.text { line-height: 1.65; }
.text :deep(p) { margin: 0 0 .75rem; }
.text :deep(ul), .text :deep(ol) { margin: 0 0 .75rem; padding-left: 1.3rem; }
.text :deep(li) { margin-bottom: .35rem; }
.text :deep(a) { color: var(--p-primary-color); }
.text :deep(code) { font-family: var(--font-mono, monospace); background: var(--p-content-hover-background); padding: .05rem .35rem; border-radius: 4px; }
.text :deep(kbd) {
    font-family: inherit; font-size: .85em; padding: .05rem .4rem; border-radius: 4px;
    border: 1px solid var(--p-content-border-color); border-bottom-width: 2px; background: var(--p-content-background);
}
.text :deep(.tip) {
    padding: .6rem .8rem; border-radius: 8px; border-left: 3px solid var(--p-primary-color);
    background: var(--p-highlight-background);
}
figure { margin: 1rem 0 0; }
figure :deep(.shot) {
    width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--p-content-border-color);
    box-shadow: 0 4px 18px rgb(0 0 0 / .08); cursor: zoom-in; display: block;
}
figure.phone { max-width: 16rem; }
figcaption { margin-top: .5rem; font-size: .88rem; color: var(--p-text-muted-color); }
.hint { text-align: center; font-size: .88rem; }

@media (max-width: 1000px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .toc { position: static; }
}
</style>
