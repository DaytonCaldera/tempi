<script lang="ts" setup>
const url_registro = '/registro/tabla';
const { data: registros } = await useApiFetch(url_registro);
async function refreshData(path: string, status: any) {
  console.log(path, status);
  if (status.value == "success")
    switch (path) {
      case url_registro:
        {
          const { data: nRegistros } = await useApiFetch(url_registro);
          registros.value = nRegistros.value;
        }
        break;

    }
}
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <PredicacionTablaRegistro :registros="registros" @actualizar-registros="refreshData(url_registro,$event)" />
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped></style>
