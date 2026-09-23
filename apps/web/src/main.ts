import App from './App.vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import './assets/style.css';
import { setUnauthorizedHandler } from './lib/auth';
import { queryClient } from './lib/query';
import { router } from './router';

setUnauthorizedHandler(() => {
    const current = router.currentRoute.value;
    if (current.name === 'sign-in') {
        return;
    }
    void router.replace({
        name: 'sign-in',
        query: { redirect: current.fullPath },
    });
});

const app = createApp(App);

app.use(createPinia());
app.use(VueQueryPlugin, { queryClient });
app.use(router);

app.mount('#app');
