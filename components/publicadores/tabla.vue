<template>
  <v-data-table
    :headers="headers"
    :items="publicadores"
    :sort-by="[{ key: 'id', order: 'asc' }]"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Publicadores</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>
        <v-btn @click="dialog = !dialog" color="primary" dark class="mb-2">
          <PublicadoresModalPublicadores
            @close="close"
            @handle-add-publicador="handleAddEditPublicador"
            :dialog="dialog"
            :form-title="formTitle"
            :edited-index="editedIndex"
            :edited-item="editedItem"
            @update-item="updateEditedItem"
            :buttonSaveTitle="buttonSaveTitle"
          ></PublicadoresModalPublicadores>
          Nuevo publicador
        </v-btn>
        <v-dialog v-model="dialogDelete" max-width="500px">
          <v-card>
            <v-card-title class="text-h5"
              >Are you sure you want to delete this item?</v-card-title
            >
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="blue-darken-1" variant="text" @click="closeDelete"
                >Cancelar</v-btn
              >
              <v-btn color="blue-darken-1" variant="text" @click="deleteItemConfirm"
                >Agregar</v-btn
              >
              <v-spacer></v-spacer>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-toolbar>
    </template>
    <template v-slot:item.actions="{ item }">
      <v-icon size="small" class="me-2" @click="editarPublicador(item)">
        mdi-pencil
      </v-icon>
      <v-icon size="small" @click="eliminarPublicador(item?.id)"> mdi-delete </v-icon>
    </template>
    <template v-slot:item.es_conductor="{ item }">
      <v-text>{{ item.es_conductor ? "Si" : "" }}</v-text>
    </template>
  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(["publicadores"]);

const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "nombre", title: "Nombre" },
  { key: "apellido1", title: "Apellido 1" },
  { key: "grupo", title: "Grupo" },
  { key: "es_conductor", title: "Es Conductor" },
  { key: "actions", title: "Acciones", align: "end" },
];

const dialog = ref(false);
const dialogDelete = ref(false);
const editedIndex = ref(-1);
const editedItem = ref({
  id: '',
  nombre: "",
  grupo_id: 0,
  grupo: "",
});

const defaultItem = ref({
  id: '',
  nombre: "",
  grupo_id: 0,
  grupo: "",
});
const formTitle = computed(() => {
  return editedIndex.value === -1 ? "Nuevo publicador" : "Editar publicador";
});
const buttonSaveTitle = computed(() => {
  return editedIndex.value === -1 ? "Agregar" : "Guardar";
});

function editarPublicador(item: any) {
  editedIndex.value = props.publicadores.indexOf(item);
  editedItem.value = Object.assign({}, item);

  dialog.value = true;
}
function deleteItem(item: any) {
  editedIndex.value = props.publicadores.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialogDelete.value = true;
}
function deleteItemConfirm() {
  props.publicadores.value.splice(editedIndex.value, 1);
  closeDelete();
}
function close() {
  dialog.value = false;
  nextTick(() => {
    editedItem.value = Object.assign({}, defaultItem.value);
    editedIndex.value = -1;
  });
}
function closeDelete() {
  dialogDelete.value = false;
  nextTick(() => {
    editedItem.value = Object.assign({}, defaultItem.value);
    editedIndex.value = -1;
  });
}

function updateEditedItem(newItem: any) {
  editedItem.value = newItem;
}

async function handleAddEditPublicador() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = {
    id: editedItem.value.id ?? null,
    nombre: editedItem.value.nombre,
    apellido1: editedItem.value.apellido1 ?? null,
    grupo_id: editedItem.value.grupo_id ?? null,
  };
  const { data, error } = await useApiFetch("/publicador", {
    method: method,
    body: body,
  });
  if (!error.value) {
    switch (method) {
      case "POST":
        {
          agregarRegistroPublicador(data.value);
        }
        break;
      case "PATCH":
        {
          const index = props.publicadores.findIndex((obj) => obj.id === data.value?.id);
          actualizarRegistroPublicador(index, data.value);
        }
        break;
    }
    close();
  } else {
    console.error(error.value);
  }
}

async function eliminarPublicador(id: number) {
  const index = props.publicadores.findIndex((object) => object.id === id);
  const response = await useApiFetch(`/publicador/${id}`, { method: "DELETE" });
  if (!response.error.value) {
    props.publicadores.splice(index, 1);
  } else {
    console.log("Algo salió mal");
  }
}

async function agregarRegistroPublicador(registro: any) {
  props.publicadores?.push({
    id: registro?.id,
    nombre: registro?.nombre,
    apellido1: registro?.apellido1,
    grupo_id: registro?.grupo.id,
    grupo: registro?.grupo.nombre,
    es_conductor: false
  });
}

async function actualizarRegistroPublicador(index: number, registro: any) {
  props.publicadores[index].nombre = registro?.nombre;
  props.publicadores[index].apellido1 = registro?.apellido1;
  props.publicadores[index].grupo_id = registro?.grupo.id;
  props.publicadores[index].grupo = registro?.grupo.nombre;
  props.publicadores[index].es_conductor = props.publicadores[index].es_conductor //TODO: Devolver si es conductor desde API
}
</script>

<style></style>
