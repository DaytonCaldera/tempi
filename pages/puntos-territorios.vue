<template>
  <v-container-fluid>
    <v-row>
      <v-col cols="12">
        <predicacion-tabla-territorios :territorios="territorios">
        </predicacion-tabla-territorios>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <PredicacionTablaPuntos :puntos="puntos" @actualizar-puntos="refreshData(url_campo.puntos, $event)">
        </PredicacionTablaPuntos>
      </v-col>
    </v-row>
  </v-container-fluid>
</template>

<script lang="ts" setup>
const url_campo = {
  territorios: "/territorio/tabla",
  puntos: "/puntos/tabla",
};
const { data: territorios } = await useApiFetch(url_campo.territorios);
const { data: puntos } = await useApiFetch(url_campo.puntos);

async function refreshData(path: string, status: any) {
  console.log(path, status);
  if (status.value == "success")
    switch (path) {
      case url_campo.territorios:
        {
          const { data: nTerritorios } = await useApiFetch(url_campo.territorios);
          territorios.value = nTerritorios.value;
        }
        break;
      case url_campo.puntos: {
        console.log("actualizando puntos");

        const { data: nPuntos } = await useApiFetch(url_campo.puntos);
        puntos.value = nPuntos.value;
      }

    }
}
</script>

<style></style>