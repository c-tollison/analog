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
                    path: 'lookup',
                    name: 'lookup',
                    meta: { title: 'Add media' },
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
                    meta: { title: 'Collections' },
                    component: () => import('@/views/CollectionsView.vue'),
                },
                {
                    path: 'collections/:id',
                    name: 'collection',
                    meta: { title: 'Collection' },
                    component: () => import('@/views/CollectionView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/settings',
                    name: 'collection-settings',
                    meta: { title: 'Collection settings' },
                    component: () =>
                        import('@/views/CollectionSettingsView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/settings/invite',
                    name: 'collection-invite',
                    meta: { title: 'Invite friends' },
                    component: () => import('@/views/CollectionInviteView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/series/:seriesId',
                    name: 'collection-series',
                    meta: { title: 'Series' },
                    component: () => import('@/views/CollectionSeriesView.vue'),
                    props: true,
                },
                {
                    path: 'collections/:id/items/:itemId',
                    name: 'collection-item',
                    meta: { title: 'Media' },
                    component: () => import('@/views/CollectionItemView.vue'),
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
