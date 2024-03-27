<template>
  <v-row>
    <v-col cols="6">
      <DiccionarioDiasTabla :dias="dias" />
    </v-col>
    <v-col cols="6">
      <DiccionarioModalidadTabla :modalidades="modalidad" />
    </v-col>

  </v-row>
  <v-row>
    <v-col cols="6">
      <DiccionarioPeriodoTabla :periodos="periodos" />
    </v-col>
  </v-row>
</template>

<script lang="ts" setup>
const { data: dias } = await useApiFetch("/dia");
const { data: modalidad } = await useApiFetch("/modalidad");
const { data: periodos } = await useApiFetch("/periodo");

</script>

<style>

</style>