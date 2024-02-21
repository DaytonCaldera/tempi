<script lang="ts" setup>
definePageMeta({
  middleware: ['auth']
})
const { data } = await useApiFetch('/publicador')
</script>

<template>
  <PublicadoresTabla :publicadores="data" />
</template>

<style scoped></style>
