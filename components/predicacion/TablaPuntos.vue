<template>
  <v-data-table :headers="headers" :items="props.puntos" style="border-opacity:0.5">
    <!-- HEADER -->
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Puntos</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>
        <v-btn @click="dialog = !dialog" color="primary" dark class="mb-2">
          <v-dialog v-model="dialog" max-width="65vw" persistent>
            <v-card>
              <v-card-title>{{ modalTitle }}</v-card-title>
              <v-card-text>
                <v-container>
                  <v-row>
                    <v-col cols="2" v-if="punto?.id > 0">
                      <v-text-field disabled>
                        {{ punto.id }}
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
                      <v-text-field v-model="punto.nombre" label="Nombre del punto"></v-text-field>
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols="12">
                      <SharedDropdownDias :id="punto.dias ?? []" :label="'Seleccione los dias disponibles'"
                        @change="updateDias($event)" />
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols="12">
                      <SharedDropdownTerritorios :id="punto.territorios ?? []"
                        :label="'Seleccione los territorios del punto'" @change="updateTerritorios($event)" />
                    </v-col>
                  </v-row>
                </v-container>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="blue-darken-1" variant="text" @click="close()">
                  Cancelar
                </v-btn>
                <v-btn color="blue-darken-1" variant="text" @click="handleAddEditPunto()">
                  {{ buttonSaveTitle }}
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
          Nuevo Punto
        </v-btn>
      </v-toolbar>
    </template>
    <template v-slot:item.territorios="{ item }">
      <v-chip v-for="territorio in item.territorios">{{ territorio?.nombre + ', ' }}</v-chip>
    </template>

    <template v-slot:item.dias="{ item }">
      <v-chip v-for="dia in item?.dias" v-if="item?.dias.length > 0">{{dia?.nombre}}</v-chip>
      <v-chip v-else>Todos</v-chip>
    </template>

    <!-- ACCIONES EN LA TABLA -->
    <template v-slot:item.actions="{ item }">
      <v-icon size="small" class="me-2" @click="editarPunto(item)">
        mdi-pencil
      </v-icon>
      <v-icon size="small" @click="console.log(item)"> mdi-delete </v-icon>
    </template>

  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(['puntos']);
const emits = defineEmits(['actualizarPuntos']);

const dialog = ref(false);

const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "nombre", title: "Puntos" },
  { key: "territorios", title: "Territorios cercanos" },
  { key: "dias", title: "Dias disponibles" },
  { key: "actions", title: "Acciones", align: "end" },
];

const punto = ref({
  id: -1,
  nombre: "",
  dias: [],
  territorios: [],
});
const defaultItem = ref({
  id: -1,
  nombre: "",
  dias: [],
  territorios: [],
});
const editedIndex = ref(-1);

const modalTitle = computed(
  () => `${editedIndex.value > 0 ? "Editar" : "Agregar"} Punto`
);
const buttonSaveTitle = computed(
  () => `${editedIndex.value > 0 ? "Guardar" : "Agregar"}`
);

function editarPunto(item: any) {
  editedIndex.value = item?.id;
  punto.value = Object.assign({}, item);
  dialog.value = true;
  console.log(punto);

}
function close() {
  dialog.value = false;
  nextTick(() => {
    punto.value = Object.assign({}, defaultItem.value);
    editedIndex.value = -1;
  });
}
async function handleAddEditPunto() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = {
    id: punto.value.id ?? null,
    nombre: punto.value.nombre,
    territorios: punto.value.territorios.map((territorio) => territorio.id ?? territorio) ?? null,
    dias: punto.value.dias.map((dia) => dia.id ?? dia) ?? null,
  };
  // console.log(method, body);
  // return;
  const { data, error, status } = await useApiFetch("/puntos", {
    method: method,
    body: body,
  });
  if (!error.value) {
    emits('actualizarPuntos', status)
    close();
  } else {
    console.error(error.value);
  }
}
function updateDias(data: any) {
  punto.value.dias = data;
}
function updateTerritorios(data: any) {
  punto.value.territorios = data;
}
</script>

<style scoped></style>