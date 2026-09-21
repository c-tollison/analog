import { getCachedSession } from '@/lib/auth';
import ForgotPasswordView from '@/views/ForgotPasswordView.vue';
import HomeView from '@/views/HomeView.vue';
import ResetPasswordView from '@/views/ResetPasswordView.vue';
import SignInView from '@/views/SignInView.vue';
import SignUpView from '@/views/SignUpView.vue';
import TwoFactorView from '@/views/TwoFactorView.vue';
import VerifyEmailView from '@/views/VerifyEmailView.vue';

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
            component: HomeView,
            meta: { requiresAuth: true },
        },
        {
            path: '/sign-in',
            name: 'sign-in',
            component: SignInView,
            meta: { guestOnly: true },
        },
        {
            path: '/sign-up',
            name: 'sign-up',
            component: SignUpView,
            meta: { guestOnly: true },
        },
        {
            path: '/verify-email',
            name: 'verify-email',
            component: VerifyEmailView,
            meta: { guestOnly: true },
            beforeEnter: requireEmailQuery,
        },
        {
            path: '/two-factor',
            name: 'two-factor',
            component: TwoFactorView,
            meta: { guestOnly: true },
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            component: ForgotPasswordView,
            meta: { guestOnly: true },
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            component: ResetPasswordView,
            meta: { guestOnly: true },
            beforeEnter: requireEmailQuery,
        },
    ],
});

router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth && !to.meta.guestOnly) {
        return true;
    }

    const session = await getCachedSession();

    if (to.meta.requiresAuth && !session) {
        return { name: 'sign-in', query: { redirect: to.fullPath } };
    }

    if (to.meta.guestOnly && session) {
        return { name: 'home' };
    }

    return true;
});
