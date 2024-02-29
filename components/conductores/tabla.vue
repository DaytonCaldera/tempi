<template>
  <v-data-table
    :headers="headers"
    :items="conductores"
    :sort-by="[{ key: 'id', order: 'asc' }]"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Conductores</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>
        <v-btn color="primary" dark class="mb-2" @click="dialog = !dialog">
          <ConductoresModalConductores
            @close="close"
            @handle-add-conductor="handleAddEditConductor"
            :dialog="dialog"
            :form-title="formTitle"
            :edited-index="editedIndex"
            :edited-item="editedItem"
            @update-item="updateEditedItem"
            :buttonSaveTitle="buttonSaveTitle"
          ></ConductoresModalConductores>
          Nuevo conductor
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
      <v-icon size="small" class="me-2" @click="editItem(item)"> mdi-pencil </v-icon>
      <v-icon size="small" @click="eliminarConductor(item?.id)"> mdi-delete </v-icon>
    </template>
    <template v-slot:item.dias="{ item }">
      <v-text>{{ item.dias.map((dia) => dia.nombre).join(", ") }}</v-text>
    </template>
    <template v-slot:item.modalidad="{ item }">
      <v-text>{{
        item.modalidad.map((modalidad) => modalidad.modalidad).join(", ")
      }}</v-text>
    </template>
  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(["conductores"]);

const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "nombre_conductor", title: "Nombre conductor" },
  { key: "dias", title: "Dias disponible" },
  { key: "modalidad", title: "Modalidades" },
  { key: "actions", title: "Acciones", align: "end" },
];

const dialog = ref(false);
const dialogDelete = ref(false);
const editedIndex = ref(-1);
const editedItem = ref({
  id: 0,
  nombre_conductor:'',
  publicador: {
    id: null,
    nombre: null,
  },
  dias: [],
  modalidad: [],
});

const defaultItem = ref({
  id: 0,
  nombre_conductor:'',
  publicador: {
    id: null,
    nombre: null,
  },
  dias: [],
  modalidad: [],
});
const formTitle = computed(() => {
  return editedIndex.value === -1 ? "Nuevo conductor" : "Editar conductor";
});

const buttonSaveTitle = computed(() => {
  return editedIndex.value === -1 ? "Agregar" : "Guardar";
});

function editItem(item: any) {
  editedIndex.value = props.conductores.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
}
function deleteItem(item: any) {
  editedIndex.value = props.conductores.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialogDelete.value = true;
}
function deleteItemConfirm() {
  props.conductores.value.splice(editedIndex.value, 1);
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

async function handleAddEditConductor() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = {
    id: editedItem.value.id ?? null,
    publicadorId: editedItem.value?.publicador?.id ?? null,
    dias: editedItem.value.dias.map((dia) => dia?.id ?? dia) ?? null,
    modalidad:
      editedItem.value.modalidad.map((modalidad) => modalidad.id ?? modalidad) ?? null,
  };
  const { data, error } = await useApiFetch("/conductor", {
    method: method,
    body: body,
  });
  if (!error.value) {
    switch (method) {
      case "POST":
        {
          agregarRegistroConductor(data.value);
        }
        break;
      case "PATCH":
        {
          const index = props.conductores.findIndex((obj) => obj.id === data.value?.id);
          actualizarRegistroConductor(index, data.value);
        }
        break;
    }
    close();
  } else {
    console.error(error.value);
  }
}

async function eliminarConductor(id: number) {
  const index = props.conductores.findIndex((object) => object.id === id);
  const response = await useApiFetch(`/conductor/${id}`, { method: "DELETE" });
  if (!response.error.value) {
    props.conductores.splice(index, 1);
  } else {
    console.log("Algo salió mal");
  }
}

async function agregarRegistroConductor(registro: any) {
  props.conductores?.push({
    id: registro?.id,
    publicador: registro?.publicador,
    nombre_conductor:registro?.publicador?.nombre + ' ' + registro?.publicador?.apellido1,
    dias: registro?.dias,
    modalidad: registro?.modalidades,
  });
}

async function actualizarRegistroConductor(index: number, registro: any) {
  props.conductores[index].publicador.id = registro?.publicador?.id;
  props.conductores[index].publicador.nombre = registro?.publicador?.nombre;
  props.conductores[index].dias = registro?.dias;
  props.conductores[index].modalidad = registro?.modalidades;
}
</script>

<style></style>
