import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            // For demo purposes, we disable the login redirect.
            return true;
        },
        session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            // TESTING OVERRIDE: Every authenticated user is treated as an admin
            if (session.user) {
                (session.user as any).role = 'ADMINISTRATOR';
            }
            return session;
        },
        jwt({ token, user }) {
            // Override session cookie data globally for UAT testing
            token.role = 'ADMINISTRATOR';
            return token;
        }
    },
    providers: [],
} satisfies NextAuthConfig;
