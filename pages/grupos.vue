<script lang="ts" setup>
definePageMeta({
  middleware: ['auth']
})
const { data } = await useApiFetch('/grupo')

</script>

<template>
  <GruposTabla :grupos="data" />
</template>

<style scoped></style>
