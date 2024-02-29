<script lang="ts" setup>
definePageMeta({
  auth: true,
});
const { data: grupos } = await useApiFetch("/grupo/tabla");
const { data: publicadores } = await useApiFetch("/publicador/tabla");
const { data: conductores } = await useApiFetch("/conductor/tabla");
</script>

<template>
  <v-row>
    <v-col cols="6">
      <GruposTabla :grupos="grupos" />
    </v-col>
    <v-col cols="6">
      <PublicadoresTabla :publicadores="publicadores" />
    </v-col>
  </v-row>
  <v-row>
    <ConductoresTabla :conductores="conductores" />
  </v-row>
</template>

<style scoped></style>
