<template>
  <v-data-table :headers="headers" :items="props.territorios">
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Territorios</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>
        <v-btn @click="dialog = !dialog" color="primary" dark class="mb-2">
          <v-dialog v-model="dialog" max-width="65vw" persistent>
            <v-card>
              <v-card-title>{{ modalTitle }}</v-card-title>
              <v-card-text>
                <v-container>
                  <v-row>
                    <v-col cols="2" v-if="territorio?.id > 0">
                      <v-text-field disabled>
                        {{ territorio.id }}
                      </v-text-field>
                    </v-col>
                    <!-- //TODO: Para el futuro, los mapas seran cargados como archivos y enviados al ftp -->
                    <!-- <v-file-input
                      accept="image/png, image/jpeg, image/bmp"
                      label="Territorio"
                      placeholder="Subir mapa de territorio"
                      prepend-icon="mdi-user"
                      show-size
                      ></v-file-input> -->
                    <v-col cols="10">
                      <v-text-field
                        v-model="territorio.nombre"
                        label="Nombre de territorio"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols="12">
                      <v-file-input
                        accept="image/png, image/jpeg, image/bmp"
                        label="Cargar mapa"
                        placeholder="Cargar un mapa"
                        prepend-icon="mdi-map"
                        v-model="territorio.mapa"
                      ></v-file-input>
                    </v-col>
                  </v-row>
                  <v-row v-if="editedIndex > 0">
                    <v-col cols="12">
                      <v-file-input
                        accept="image/png, image/jpeg, image/bmp"
                        label="Si existe una fraccion cargue el archivo"
                        placeholder="Si existe una fraccion cargue el archivo"
                        prepend-icon="mdi-map"
                        v-model="territorio.fraccion"
                      ></v-file-input>
                    </v-col>
                  </v-row>
                </v-container>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="blue-darken-1" variant="text" @click="close()">
                  Cancelar
                </v-btn>
                <v-btn
                  color="blue-darken-1"
                  variant="text"
                  @click="handleAddTerritorio()"
                >
                  {{ buttonSaveTitle }}
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
          Nuevo territorio
        </v-btn>
      </v-toolbar>
    </template>
    <template v-slot:item.mapa="{ item }">
      <v-btn @click="mostrarMapa(item?.mapa)" v-if="item.mapa"> Ver mapa </v-btn>
      <v-text v-else>No hay mapa</v-text>
    </template>
    <template v-slot:item.fraccion="{ item }">
      <v-btn @click="mostrarMapa(item?.fraccion)" v-if="item.fraccion">
        Ver fraccion
      </v-btn>
      <v-text v-else>Sin fraccion</v-text>
      <!-- <v-btn @click="console.log(item)" >
        Editar / Agregar fraccion
      </v-btn> -->
    </template>
    <template v-slot:item.actions="{ item }">
      <v-icon size="small" class="me-2" @click="editarTerritorio(item)">
        mdi-pencil
      </v-icon>
      <v-icon size="small" @click="console.log(item)"> mdi-delete </v-icon>
    </template>
  </v-data-table>
  <v-dialog v-model="dialog_mapa">
    <v-img :src="mapa">
      <template v-slot:placeholder
        ><v-skeleton-loader type="image"></v-skeleton-loader
      ></template>
    </v-img>
  </v-dialog>
</template>

<script lang="ts" setup>
const props = defineProps(["territorios"]);
const dialog = ref(false);
const dialog_mapa = ref(false);
const mapa = ref("");
const territorio = ref({
  id: -1,
  nombre: "",
  mapa: undefined,
  fraccion: undefined,
});
const defaultItem = ref({
  id: -1,
  nombre: "",
  mapa: undefined,
  fraccion: undefined,
});

const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "nombre", title: "Territorio" },
  { key: "mapa", title: "Mapa" },
  { key: "fraccion", title: "Fraccion" },
  { key: "actions", title: "Acciones", align: "end" },
];

function mostrarMapa(item: any) {
  mapa.value = item;
  dialog_mapa.value = true;
}
function close() {
  dialog.value = false;
  nextTick(() => {
    territorio.value = Object.assign({}, defaultItem.value);
    editedIndex.value = -1;
  });
}
const editedIndex = ref(-1);
const modalTitle = computed(
  () => `${editedIndex.value > 0 ? "Editar" : "Agregar"} Territorio`
);
const buttonSaveTitle = computed(
  () => `${editedIndex.value > 0 ? "Guardar" : "Agregar"}`
);
function editarTerritorio(item: any) {
  editedIndex.value = item?.id;
  const { mapa, fraccion, ...data } = item;
  territorio.value = Object.assign({}, data);
  dialog.value = true;
}
async function handleAddTerritorio() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = new FormData();
  body.append("nombre", territorio.value.nombre as string);
  if(territorio.value.id > -1) body.append("id",territorio.value.id.toString());
  if (territorio.value.mapa !== undefined)
    body.append("mapa", territorio.value.mapa as Blob);
  if (territorio.value.fraccion !== undefined)
    body.append("fraccion", territorio.value.fraccion as Blob);
  const { data, error, status } = await useApiFetch("/territorio", {
    method: method,
    body: body,
  });
  console.log(method, body);
}
</script>

<style></style>
