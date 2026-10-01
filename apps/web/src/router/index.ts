import { hasRole, UserRole } from '@analog/types';
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
        requiresRole?: UserRole;
        title?: string;
    }
}

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
                    redirect: { name: 'log' },
                },
                {
                    path: 'shelves',
                    name: 'collections',
                    meta: { title: 'Shelves' },
                    component: () => import('@/views/CollectionsView.vue'),
                },
                {
                    path: 'shelves/:id',
                    name: 'collection',
                    meta: { title: 'Shelf' },
                    component: () => import('@/views/CollectionView.vue'),
                    props: true,
                },
                {
                    path: 'shelves/:id/settings',
                    name: 'collection-settings',
                    meta: { title: 'Shelf settings' },
                    component: () =>
                        import('@/views/CollectionSettingsView.vue'),
                    props: true,
                },
                {
                    path: 'shelves/:id/settings/invite',
                    name: 'collection-invite',
                    meta: { title: 'Invite friends' },
                    component: () => import('@/views/CollectionInviteView.vue'),
                    props: true,
                },
                {
                    path: 'shelves/:id/series/:seriesId',
                    name: 'collection-series',
                    meta: { title: 'Series' },
                    component: () => import('@/views/CollectionSeriesView.vue'),
                    props: true,
                },
                {
                    path: 'shelves/:id/scan',
                    name: 'collection-scan',
                    meta: { title: 'Scan' },
                    component: () => import('@/views/CollectionScanView.vue'),
                    props: true,
                },
                {
                    path: 'log',
                    name: 'log',
                    meta: { title: 'Log' },
                    component: () => import('@/views/LogView.vue'),
                },
                {
                    path: 'items/:id',
                    name: 'item',
                    meta: { title: 'Media' },
                    component: () => import('@/views/ItemView.vue'),
                    props: true,
                },
                {
                    path: 'series/:id',
                    name: 'series',
                    meta: { title: 'Series' },
                    component: () => import('@/views/SeriesView.vue'),
                    props: true,
                },
                {
                    path: 'friends',
                    name: 'friends',
                    meta: { title: 'Friends' },
                    component: () => import('@/views/FriendsView.vue'),
                },
                {
                    path: 'users/:username',
                    name: 'user',
                    meta: { title: 'Profile' },
                    component: () => import('@/views/UserView.vue'),
                    props: true,
                },
                {
                    path: 'notifications',
                    name: 'notifications',
                    meta: { title: 'Notifications' },
                    component: () => import('@/views/NotificationsView.vue'),
                },
                {
                    // Old links land on your own page.
                    path: 'profile',
                    name: 'profile',
                    component: () => import('@/views/UserView.vue'),
                    beforeEnter: () => {
                        const username =
                            useSessionStore().session?.user.username;
                        return username
                            ? { name: 'user', params: { username } }
                            : { name: 'home' };
                    },
                },
                {
                    path: 'profile/settings',
                    name: 'profile-settings',
                    meta: { title: 'Edit profile' },
                    component: () => import('@/views/ProfileSettingsView.vue'),
                },
                {
                    path: 'admin',
                    name: 'admin',
                    component: () => import('@/views/AdminView.vue'),
                    meta: { title: 'Admin', requiresRole: UserRole.Admin },
                },
                {
                    path: 'admin/lookup',
                    name: 'admin-lookup',
                    component: () => import('@/views/AdminLookupView.vue'),
                    meta: { title: 'Admin', requiresRole: UserRole.Admin },
                },
                {
                    path: 'admin/items/:id',
                    name: 'admin-item',
                    component: () => import('@/views/AdminItemView.vue'),
                    meta: { title: 'Admin', requiresRole: UserRole.Admin },
                    props: true,
                },
                {
                    path: 'admin/series/:id',
                    name: 'admin-series',
                    component: () => import('@/views/AdminSeriesView.vue'),
                    meta: { title: 'Admin', requiresRole: UserRole.Admin },
                    props: true,
                },
            ],
        },
        {
            path: '/sign-in',
            name: 'sign-in',
            component: () => import('@/views/SignInView.vue'),
            meta: { title: 'Sign in', guestOnly: true },
        },
        {
            path: '/sign-up',
            name: 'sign-up',
            component: () => import('@/views/SignUpView.vue'),
            meta: { title: 'Sign up', guestOnly: true },
        },
        {
            path: '/verify-email',
            name: 'verify-email',
            component: () => import('@/views/VerifyEmailView.vue'),
            meta: { title: 'Verify email', guestOnly: true },
            beforeEnter: requireEmailQuery,
        },
        {
            path: '/two-factor',
            name: 'two-factor',
            component: () => import('@/views/TwoFactorView.vue'),
            meta: { title: 'Sign in', guestOnly: true },
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            component: () => import('@/views/ForgotPasswordView.vue'),
            meta: { title: 'Forgot password', guestOnly: true },
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            component: () => import('@/views/ResetPasswordView.vue'),
            meta: { title: 'Reset password', guestOnly: true },
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

    if (to.meta.requiresRole && !hasRole(session?.user, to.meta.requiresRole)) {
        return { name: 'home' };
    }

    return true;
});
