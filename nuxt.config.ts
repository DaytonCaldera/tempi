import { RuntimeConfig } from 'nuxt/schema';
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      NUXT_BASE_URL: process.env.NUXT_AUTH_ORIGIN,
    },
  },
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt',
    '@sidebase/nuxt-auth'

  ],
  build: {
    transpile: ["vuetify"],
  },
  auth: {
    provider: {
      type: 'local',
      endpoints: {
        signIn: { path: '/auth/login', method: 'post' },
        signOut: { path: '/auth/logout', method: 'post' },
        signUp: { path: '/auth/register', method: 'post' },
        getSession: { path: '/auth/profile', method: 'get' }
      },
      pages: {
        login: '/auth/login'
      },
      token: {
        maxAgeInSeconds: 60 * 60 * 24,
        sameSiteAttribute: 'lax',
        headerName: 'Authorization',
        type: 'Bearer'
      }
    },
    globalAppMiddleware: {
      isEnabled: true
    },
    computed: {
      origin: process.env.NUXT_AUTH_ORIGIN,
      fullBaseUrl: process.env.NUXT_AUTH_ORIGIN + '/',
      pathname: '/'
    },
    origin: process.env.NUXT_AUTH_ORIGIN,
    baseUrl: process.env.NUXT_AUTH_ORIGIN,
  }
})
