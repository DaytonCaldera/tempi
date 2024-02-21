<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  auth: {
    unauthenticatedOnly: false,
  }
})
</script>

<template>
  <div>
    Page: Inicio
  </div>
</template>

<style scoped></style>