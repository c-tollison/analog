import App from './App.vue';
import { createApp } from 'vue';
import './assets/style.css';
import { API_CLIENT_KEY, createApiClient } from './lib/api';
import { API_URL } from './lib/env';
import { router } from './router';

const app = createApp(App);

app.provide(API_CLIENT_KEY, createApiClient({ baseUrl: API_URL }));
app.use(router);

app.mount('#app');
