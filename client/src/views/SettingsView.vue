<script setup>
// Podešavanja: izgled i jezik, API servisi, lokalni fajlovi, backup, o aplikaciji
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import ToggleSwitch from 'primevue/toggleswitch';
import Password from 'primevue/password';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { api } from '../api.js';
import { loadAll } from '../store.js';
import { useTheme, useTextSize } from '../theme.js';
import { setLocale } from '../i18n/index.js';

const { t, d, locale } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { mode, setTheme } = useTheme();
const { textSize, setTextSize } = useTextSize();

const services = ref([]);
const keyDraft = ref({});
const testing = ref({});
const testResult = ref({});
const backup = ref(null);
const system = ref(null);
const busy = ref({});

onMounted(async () => {
    [services.value, backup.value, system.value] = await Promise.all([api.services(), api.backupInfo(), api.system()]);
});

const error = e => toast.add({ severity: 'error', summary: t('common.error'), detail: e.message, life: 5000 });
const ok = summary => toast.add({ severity: 'success', summary, life: 2500 });

// --- API servisi -----------------------------------------------------
async function updateService(s, data) {
    try {
        Object.assign(s, await api.updateService(s.id, data));
        keyDraft.value[s.id] = '';
        testResult.value[s.id] = null;
        ok(t('common.saved'));
    } catch (e) { error(e); }
}

async function testService(s) {
    testing.value[s.id] = true;
    try { testResult.value[s.id] = await api.testService(s.id); }
    catch (e) { testResult.value[s.id] = { ok: false, error: e.message }; }
    finally { testing.value[s.id] = false; }
}

// --- Fajlovi ---------------------------------------------------------
async function run(key, fn, done) {
    busy.value[key] = true;
    try { await done(await fn()); } catch (e) { error(e); } finally { busy.value[key] = false; }
}

const cacheImages = () => run('images', api.cacheAllImages, async r => {
    toast.add({ severity: r.failed ? 'warn' : 'success', summary: t('settings.images_done', r), life: 5000 });
    await loadAll();
});
const clearCache = () => run('cache', api.clearLookupCache, r => ok(t('settings.cache_cleared', { n: r.removed })));

// --- Backup ----------------------------------------------------------
const makeBackup = () => run('backup', api.createBackup, r => { backup.value = r; ok(t('settings.backup_created')); });

function removeBackup(b) {
    confirm.require({
        header: t('common.delete'),
        message: t('settings.backup_delete_confirm', { name: b.name }),
        icon: 'pi pi-exclamation-triangle',
        acceptProps: { label: t('common.delete'), severity: 'danger' },
        rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
        accept: async () => { await api.deleteBackup(b.name); backup.value = await api.backupInfo(); }
    });
}

const checkUpdate = () => run('update', api.checkUpdate, r => (system.value = r));

const size = b => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = s => d(new Date(s), 'short');
const themes = [{ value: 'light', icon: 'pi pi-sun' }, { value: 'dark', icon: 'pi pi-moon' }, { value: 'system', icon: 'pi pi-desktop' }];
const textSizes = ['small', 'normal', 'large'].map(value => ({ value }));
const languages = [{ value: 'sr', label: 'Srpski' }, { value: 'en', label: 'English' }];
const latestInfo = () => system.value?.update.versions.find(v => v.version === system.value.update.latest);
</script>

<template>
    <div class="page narrow">
        <div class="page-head"><h1>{{ t('nav.settings') }}</h1></div>

        <!-- IZGLED -->
        <section class="card card-pad">
            <h3>{{ t('settings.appearance') }}</h3>
            <div class="setting">
                <span>{{ t('settings.theme') }}</span>
                <SelectButton :modelValue="mode" @update:modelValue="v => v && setTheme(v)" :options="themes" optionValue="value" :allowEmpty="false">
                    <template #option="{ option }"><i :class="option.icon" /> {{ t(`settings.theme_${option.value}`) }}</template>
                </SelectButton>
            </div>
            <div class="setting">
                <span>{{ t('settings.text_size') }}</span>
                <SelectButton :modelValue="textSize" @update:modelValue="v => v && setTextSize(v)" :options="textSizes" optionValue="value" :allowEmpty="false">
                    <template #option="{ option }"><span :class="'ts-' + option.value">A</span> {{ t('settings.text_' + option.value) }}</template>
                </SelectButton>
            </div>
            <div class="setting">
                <span>{{ t('settings.language') }}</span>
                <SelectButton :modelValue="locale" @update:modelValue="v => v && setLocale(v)" :options="languages"
                              optionLabel="label" optionValue="value" :allowEmpty="false" />
            </div>
        </section>

        <!-- API SERVISI -->
        <section class="card card-pad">
            <h3>{{ t('settings.api_services') }}</h3>
            <p class="muted">{{ t('settings.api_intro') }}</p>
            <div v-for="s in services" :key="s.id" class="service">
                <div class="row">
                    <strong class="grow">{{ s.name }} <span class="muted small">{{ s.endpoint }}</span></strong>
                    <Tag v-if="!s.supported" :value="t('settings.not_supported')" severity="secondary" />
                    <ToggleSwitch :modelValue="s.is_active" :disabled="!s.has_key"
                                  @update:modelValue="v => updateService(s, { is_active: v })" v-tooltip="t('settings.enabled')" />
                </div>
                <div class="row key">
                    <span class="muted small">{{ s.has_key ? t('settings.key_saved', { hint: s.key_hint }) : t('settings.no_key') }}</span>
                    <Password v-model="keyDraft[s.id]" :feedback="false" toggleMask :placeholder="t('settings.new_key')" class="grow" inputClass="mono" fluid />
                    <Button :label="t('common.save')" size="small" :disabled="!keyDraft[s.id]" @click="updateService(s, { api_key: keyDraft[s.id], is_active: true })" />
                    <Button :label="t('settings.test')" size="small" severity="secondary" outlined :disabled="!s.is_active"
                            :loading="testing[s.id]" @click="testService(s)" />
                </div>
                <Message v-if="testResult[s.id]" :severity="testResult[s.id].ok ? 'success' : 'error'" size="small" class="mt">
                    {{ testResult[s.id].ok ? t('settings.test_ok', { n: testResult[s.id].count }) : t('settings.test_failed', { error: testResult[s.id].error }) }}
                </Message>
            </div>
            <div class="row mt">
                <Button :label="t('settings.clear_cache')" icon="pi pi-eraser" size="small" severity="secondary" text
                        :loading="busy.cache" @click="clearCache" v-tooltip="t('settings.clear_cache_hint')" />
            </div>
        </section>

        <!-- LOKALNI FAJLOVI -->
        <section class="card card-pad">
            <h3>{{ t('settings.local_files') }}</h3>
            <p class="muted">{{ t('settings.local_files_intro') }}</p>
            <Button :label="t('settings.cache_images')" icon="pi pi-images" severity="secondary" outlined
                    :loading="busy.images" @click="cacheImages" />
        </section>

        <!-- BACKUP -->
        <section class="card card-pad">
            <h3>{{ t('settings.backup') }}</h3>
            <p v-if="backup" class="muted">
                {{ t('settings.backup_intro', { size: size(backup.db_size) }) }}<br />
                <span class="mono small">{{ backup.folder }}</span>
            </p>
            <Button :label="t('settings.backup_now')" icon="pi pi-save" :loading="busy.backup" @click="makeBackup" />
            <div v-if="backup?.backups.length" class="backups">
                <div v-for="b in backup.backups.slice(0, 10)" :key="b.name" class="row brow">
                    <i class="pi pi-database muted" />
                    <span class="grow mono small ellipsis">{{ b.name }}</span>
                    <span class="muted small">{{ fmtDate(b.created_at) }} · {{ size(b.size) }}</span>
                    <Button as="a" :href="`/api/backup/${encodeURIComponent(b.name)}`" icon="pi pi-download" text rounded size="small"
                            severity="secondary" v-tooltip="t('settings.download')" />
                    <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="removeBackup(b)" />
                </div>
            </div>
            <p class="muted small mt">{{ t('settings.restore_hint') }}</p>
        </section>

        <!-- O APLIKACIJI -->
        <section v-if="system" class="card card-pad">
            <h3>{{ t('settings.about') }}</h3>
            <div class="row">
                <span class="grow">Component Tracker <strong>v{{ system.version }}</strong> <span class="muted small">· Node {{ system.node }}</span></span>
                <Button :label="t('settings.check_update')" icon="pi pi-refresh" size="small" severity="secondary" outlined
                        :loading="busy.update" @click="checkUpdate" />
            </div>
            <Message v-if="system.update.available" severity="info" class="mt">
                <strong>{{ t('settings.update_available') }}: v{{ system.update.latest }}</strong>
                <span v-if="latestInfo()"> – {{ latestInfo().title }}</span>
                <ul v-if="latestInfo()?.features?.length"><li v-for="f in latestInfo().features" :key="f">{{ f }}</li></ul>
                <a v-if="system.update.download_url" :href="system.update.download_url" target="_blank" rel="noopener">{{ t('settings.download') }}</a>
            </Message>
            <p v-else-if="system.update.error" class="muted small mt">{{ t('settings.update_error', { error: system.update.error }) }}</p>
            <p v-else-if="system.update.latest" class="muted small mt"><i class="pi pi-check-circle" /> {{ t('settings.up_to_date') }}</p>
            <p v-if="system.lan_urls.length" class="muted small mt">{{ t('settings.lan', { urls: system.lan_urls.join(', ') }) }}</p>
            <p class="muted small">{{ t('settings.data_dir') }}: <span class="mono">{{ system.data_dir }}</span></p>
            <div class="author">
                <img src="/favicon.svg" alt="" />
                <span>© {{ new Date().getFullYear() }} mera-system ·
                    <a href="https://mera-system.com" target="_blank" rel="noopener">mera-system.com</a>
                    <span class="muted"> · {{ t('settings.license') }} CC BY-NC 4.0</span></span>
            </div>
        </section>
    </div>
</template>

<style scoped>
.narrow { max-width: 52rem; }
.setting { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .4rem 0; flex-wrap: wrap; }
.service { padding: .75rem 0; border-top: 1px solid var(--p-content-border-color); }
.key { margin-top: .5rem; flex-wrap: wrap; }
.small { font-size: .82rem; }
.ts-small { font-size: .8rem; font-weight: 700; }
.ts-normal { font-size: 1rem; font-weight: 700; }
.ts-large { font-size: 1.2rem; font-weight: 700; }
.mt { margin-top: .75rem; }
.author {
    display: flex; align-items: center; gap: .6rem; margin-top: 1rem; padding-top: .75rem;
    border-top: 1px solid var(--p-content-border-color); font-size: .85rem;
}
.author img { width: 1.6rem; height: 1.6rem; flex-shrink: 0; }
.backups { margin-top: .75rem; }
.brow { padding: .2rem 0; }
</style>
