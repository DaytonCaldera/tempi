<template>
  <v-row>
    <v-col cols="6">
      <DiccionarioDiasTabla :dias="dias" />
    </v-col>
    <v-col cols="6">
      <DiccionarioModalidadTabla :modalidades="modalidad" />
    </v-col>

  </v-row>
</template>

<script lang="ts" setup>
const { data: dias } = await useApiFetch("/dia");
const { data: modalidad } = await useApiFetch("/modalidad");
console.log(dias, modalidad);

</script>

<style>

</style>