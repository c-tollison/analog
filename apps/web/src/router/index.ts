import { useSessionStore } from '@/stores/session';

import {
    createRouter,
    createWebHistory,
    type NavigationGuard,
} from 'vue-router';

declare module 'vue-router' {
    interface RouteMeta {
        requiresAuth?: boolean;
        guestOnly?: boolean;
    }
}

const requireEmailQuery: NavigationGuard = (to) =>
    typeof to.query.email === 'string' && to.query.email !== ''
        ? true
        : { name: 'sign-in' };

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('@/views/HomeView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/scan',
            name: 'scan',
            component: () => import('@/views/ScanView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/collections',
            name: 'collections',
            component: () => import('@/views/CollectionsView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/collections/:id',
            name: 'collection',
            component: () => import('@/views/CollectionView.vue'),
            props: true,
            meta: { requiresAuth: true },
        },
        {
            path: '/collections/:id/series/:seriesId',
            name: 'collection-series',
            component: () => import('@/views/CollectionSeriesView.vue'),
            props: true,
            meta: { requiresAuth: true },
        },
        {
            path: '/sign-in',
            name: 'sign-in',
            component: () => import('@/views/SignInView.vue'),
            meta: { guestOnly: true },
        },
        {
            path: '/sign-up',
            name: 'sign-up',
            component: () => import('@/views/SignUpView.vue'),
            meta: { guestOnly: true },
        },
        {
            path: '/verify-email',
            name: 'verify-email',
            component: () => import('@/views/VerifyEmailView.vue'),
            meta: { guestOnly: true },
            beforeEnter: requireEmailQuery,
        },
        {
            path: '/two-factor',
            name: 'two-factor',
            component: () => import('@/views/TwoFactorView.vue'),
            meta: { guestOnly: true },
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            component: () => import('@/views/ForgotPasswordView.vue'),
            meta: { guestOnly: true },
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            component: () => import('@/views/ResetPasswordView.vue'),
            meta: { guestOnly: true },
            beforeEnter: requireEmailQuery,
        },
    ],
});

router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth && !to.meta.guestOnly) {
        return true;
    }

    const session = await useSessionStore().load();

    if (to.meta.requiresAuth && !session) {
        return { name: 'sign-in', query: { redirect: to.fullPath } };
    }

    if (to.meta.guestOnly && session) {
        return { name: 'home' };
    }

    return true;
});
