<script setup lang="ts">
import { RouterView } from "vue-router";
definePageMeta({
  middleware: ['guest']
})
</script>
<template>
  <v-app>
    <RouterView />
  </v-app>
</template>
