<script lang="ts" setup>
definePageMeta({
  middleware: ['auth']
})
const { data } = await useApiFetch('/publicador/tabla')
</script>

<template>
  <PublicadoresTabla :publicadores="data" />
</template>

<style scoped></style>
