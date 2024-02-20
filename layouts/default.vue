<!-- <script lang="ts" setup>
// import {useAuthStore} from "@/stores/useAuthStore";
 
 const auth = useAuthStore();
  
 async function handleLogout() {
   await auth.logout();
 }
</script>

<template>
  <div>
    <button v-if="auth.isLoggedIn" @click="handleLogout">Logout</button>
 
    <pre>{{ auth.user }}</pre>
 
    <ul>
      <li>
        <NuxtLink to="/">Home</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/register">Register</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/login">Login</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/auth-only">Auth only</NuxtLink>
      </li>
      <li>
        <NuxtLink to="/guest-only">Guest only</NuxtLink>
      </li>
    </ul>
    <slot />
  </div>
</template> -->

<style scoped></style>


<script setup lang="ts">
import { RouterView } from 'vue-router';
const title = ref("Modernize - Nuxt3 Typescript based Free Admin Dashboard Template");
useHead({
  meta: [{ content: title }],
  titleTemplate: (titleChunk) => {
    return titleChunk
      ? `${titleChunk} - Nuxt3 Typescript based Free Admin Dashboard Template`
      : "Modernize - Nuxt3 Typescript based Free Admin Dashboard Template";
  },
});
definePageMeta({
    middleware:['auth']
})
</script>

<template>
    <v-locale-provider>
        <v-app>
            <LayoutFullMain/>
            <v-main>
                <v-container fluid class="page-wrapper">
                    <div class="maxWidth">
                        <RouterView />
                    </div>
                </v-container>
            </v-main>
        </v-app>
    </v-locale-provider>
</template>
