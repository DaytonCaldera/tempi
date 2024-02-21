// https://nuxt.com/docs/api/configuration/nuxt-config
import { AppEnv } from "./env-vars";
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      NUXT_BASE_URL: process.env.NUXT_AUTH_API_SERVER_URL,
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
    // baseURL: 'https://api.tempi.pro/', 
    baseURL: 'http://localhost:3100/', 
    globalAppMiddleware: {
      isEnabled: true
    }
  }
})
