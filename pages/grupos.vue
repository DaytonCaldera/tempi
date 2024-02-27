<script lang="ts" setup>
definePageMeta({
  auth: true
})
const { data } = await useApiFetch('/grupo/tabla')

</script>

<template>
  <GruposTabla :grupos="data" />
</template>

<style scoped></style>
