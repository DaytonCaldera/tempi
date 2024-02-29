<template>
  <v-data-table
    :headers="headers"
    :items="dias"
    :sort-by="[{ key: 'id', order: 'asc' }]"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Dias</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>

        <v-btn color="primary" dark class="mb-2" @click="dialog = !dialog">
          <DiccionarioDiasModal
            @close="close"
            @handle-add-dia="handleAddEditDia"
            :dialog="dialog"
            :form-title="formTitle"
            :edited-index="editedIndex"
            :edited-item="editedItem"
            @update-item="updateEditedItem"
            :buttonSaveTitle="buttonSaveTitle"
          ></DiccionarioDiasModal>
          Nuevo dia
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
      <v-icon size="small" @click="eliminarDia(item?.id)"> mdi-delete </v-icon>
    </template>
  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(["dias"]);

const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "nombre", title: "Dia" },
  { key: "actions", title: "Acciones", align: "end" },
];

const dialog = ref(false);
const dialogDelete = ref(false);
const editedIndex = ref(-1);
const editedItem = ref({
  id: 0,
  nombre: "",
});

const defaultItem = ref({
  id: 0,
  nombre: "",
});
const formTitle = computed(() => {
  return editedIndex.value === -1 ? "Nuevo dia" : "Editar dia";
});

const buttonSaveTitle = computed(() => {
  return editedIndex.value === -1 ? "Agregar" : "Guardar";
});

function editItem(item: any) {
  editedIndex.value = props.dias.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
}
function deleteItem(item: any) {
  editedIndex.value = props.dias.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialogDelete.value = true;
}
function deleteItemConfirm() {
  props.dias.value.splice(editedIndex.value, 1);
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

console.log(props.dias);
watch(props.dias, (val) => {
  console.log(val);
});
async function handleAddEditDia() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = {
    id: editedItem.value.id ?? null,
    nombre: editedItem.value.nombre,
  };
  const { data, error } = await useApiFetch("/dia", {
    method: method,
    body: body,
  });
  if (!error.value) {
    switch (method) {
      case "POST":
        {
          agregarRegistroDia(data.value);
        }
        break;
      case "PATCH":
        {
          const index = props.dias.findIndex((obj) => obj.id === data.value?.id);
          actualizarRegistroDia(index, data.value);
        }
        break;
    }
    close();
  } else {
    console.error(error.value);
  }
}

async function eliminarDia(id: number) {
  const index = props.dias.findIndex((object) => object.id === id);
  const response = await useApiFetch(`/dia/${id}`, { method: "DELETE" });
  if (!response.error.value) {
    props.dias.splice(index, 1);
  } else {
    console.log("Algo salió mal");
  }
}

async function agregarRegistroDia(registro: any) {
  props.dias?.push({
    id: registro?.id,
    nombre: registro?.nombre,
  });
}

async function actualizarRegistroDia(index: number, registro: any) {
  props.dias[index].nombre = registro?.nombre;
}
</script>

<style></style>
