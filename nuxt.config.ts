// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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
        signIn: { path: '/login', method: 'post' },
        signOut: { path: '/logout', method: 'post' },
        signUp: { path: '/register', method: 'post' },
        getSession: { path: '/profile', method: 'get' }
      },
      pages: {
        login: '/auth/login'
      },
      token: {
        maxAgeInSeconds: 60 * 60 * 1,
        sameSiteAttribute: 'lax',
        headerName:'Authorization',
        type:'Bearer'
      }
    },
    baseURL: 'http://localhost:3100/auth',
    globalAppMiddleware: {
      isEnabled: true
    }
  }
})
