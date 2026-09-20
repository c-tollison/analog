import './assets/style.css';

import App from './App.vue';
import { API_CLIENT_KEY, createApiClient } from './lib/api';
import { API_URL } from './lib/env';
import { createApp } from 'vue';

const app = createApp(App);

app.provide(API_CLIENT_KEY, createApiClient({ baseUrl: API_URL }));

app.mount('#app');
