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

const requireCollectionQuery: NavigationGuard = (to) =>
    typeof to.query.collection === 'string' && to.query.collection !== ''
        ? true
        : { name: 'collections' };

const requireEmailQuery: NavigationGuard = (to) =>
    typeof to.query.email === 'string' && to.query.email !== ''
        ? true
        : { name: 'sign-in' };

export const router = createRouter({
    history: createWebHistory(),
    scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
    routes: [
        {
            path: '/',
            component: () => import('@/components/layout/AppLayout.vue'),
            meta: { requiresAuth: true },
            children: [
                {
                    path: '',
                    name: 'home',
                    redirect: { name: 'collections' },
                },
                {
                    path: 'scan',
                    name: 'scan',
                    component: () => import('@/views/ScanView.vue'),
                },
                {
                    path: 'lookup',
                    name: 'lookup',
                    component: () => import('@/views/LookupView.vue'),
                    beforeEnter: requireCollectionQuery,
                    props: (route) => ({
                        collectionId:
                            typeof route.query.collection === 'string'
                                ? route.query.collection
                                : '',
                    }),
                },
                {
                    path: 'collections',
                    name: 'collections',
                    component: () => import('@/views/CollectionsView.vue'),
                },
                {
                    path: 'collections/:id',
                    name: 'collection',
                    component: () => import('@/views/CollectionView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/settings',
                    name: 'collection-settings',
                    component: () =>
                        import('@/views/CollectionSettingsView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/settings/invite',
                    name: 'collection-invite',
                    component: () => import('@/views/CollectionInviteView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/series/:seriesId',
                    name: 'collection-series',
                    component: () => import('@/views/CollectionSeriesView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/items/:itemId',
                    name: 'collection-item',
                    component: () => import('@/views/CollectionItemView.vue'),
                    props: true,
                },
                {
                    path: 'friends',
                    name: 'friends',
                    component: () => import('@/views/FriendsView.vue'),
                },
                {
                    path: 'users/:username',
                    name: 'user',
                    component: () => import('@/views/UserView.vue'),
                    props: true,
                },
                {
                    path: 'notifications',
                    name: 'notifications',
                    component: () => import('@/views/NotificationsView.vue'),
                },
                {
                    path: 'profile',
                    name: 'profile',
                    component: () => import('@/views/ProfileView.vue'),
                },
            ],
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
