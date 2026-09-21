import App from './App.vue';
import { createApp } from 'vue';
import './assets/style.css';
import { API_CLIENT_KEY, createApiClient } from './lib/api';
import { setUnauthorizedHandler } from './lib/auth';
import { API_URL } from './lib/env';
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

app.provide(API_CLIENT_KEY, createApiClient({ baseUrl: API_URL }));
app.use(router);

app.mount('#app');
