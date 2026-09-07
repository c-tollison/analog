import './assets/style.css';

import App from './App.vue';
import { API_CLIENT_KEY, createApiClient } from './lib/api';
import { createApp } from 'vue';

const app = createApp(App);

app.provide(
    API_CLIENT_KEY,
    createApiClient({ baseUrl: import.meta.env.VITE_API_URL })
);

app.mount('#app');
