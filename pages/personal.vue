<script lang="ts" setup>
definePageMeta({
  auth: true,
});
const url_personal = {
  grupos: "/grupo/tabla",
  publicadores: "/publicador/tabla",
  conductores: "/conductor/tabla",
};
const { data: grupos } = await useApiFetch(url_personal.grupos);
const { data: publicadores } = await useApiFetch(url_personal.publicadores);
const { data: conductores } = await useApiFetch(url_personal.conductores);

async function refreshData(path: string, status: any) {
  console.log(path, status);
  if (status.value == "success")
    switch (path) {
      case url_personal.grupos:
        {
          const { data: nGrupos } = await useApiFetch(url_personal.grupos);
          grupos.value = nGrupos.value;
        }
        break;
      case url_personal.conductores: {
        console.log("actualizando conductores");

        const { data: nConductores } = await useApiFetch(url_personal.conductores);
        conductores.value = nConductores.value;
      }
      case url_personal.publicadores:
        {
          console.log("actualizando publicadores");
          const { data: nPublicadores } = await useApiFetch(url_personal.publicadores);
          publicadores.value = nPublicadores.value;
        }
        break;
    }
}
</script>

<template>
  <v-row>
    <v-col cols="12" md="6" lg="6">
      <GruposTabla :grupos="grupos" @actualizar-grupos="refreshData(url_personal.grupos, $event)" />
    </v-col>
    <v-col cols="12" md="6" lg="6
    ">
      <PublicadoresTabla :publicadores="publicadores"
        @actualizar-publicadores="refreshData(url_personal.publicadores, $event)" />
    </v-col>
  </v-row>
  <v-row>
    <v-col cols="12">
      <ConductoresTabla :conductores="conductores"
        @actualizar-conductores="refreshData(url_personal.conductores, $event)" />
    </v-col>
  </v-row>
</template>

<style scoped></style>
