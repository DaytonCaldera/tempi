<script lang="ts" setup>
definePageMeta({
  auth: true
})
const { data } = await useApiFetch('/grupo')

</script>

<template>
  <GruposTabla :grupos="data" />
</template>

<style scoped></style>
