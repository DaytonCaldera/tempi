<template>
  <v-data-table
    :headers="headers"
    :items="modalidades"
    :sort-by="[{ key: 'id', order: 'asc' }]"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Modalidades</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>

        <v-btn color="primary" dark class="mb-2" @click="dialog = !dialog">
          <DiccionarioModalidadModal
            @close="close"
            @handle-add-modalidad="handleAddEditModalidad"
            :dialog="dialog"
            :form-title="formTitle"
            :edited-index="editedIndex"
            :edited-item="editedItem"
            @update-item="updateEditedItem"
            :buttonSaveTitle="buttonSaveTitle"
          ></DiccionarioModalidadModal>
          Nueva modalidad
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
      <v-icon size="small" @click="eliminarModalidad(item?.id)"> mdi-delete </v-icon>
    </template>
  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(["modalidades"]);

const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "modalidad", title: "Modalidad" },
  { key: "actions", title: "Acciones", align: "end" },
];

const dialog = ref(false);
const dialogDelete = ref(false);
const editedIndex = ref(-1);
const editedItem = ref({
  id: 0,
  modalidad: "",
});

const defaultItem = ref({
  id: 0,
  modalidad: "",
});
const formTitle = computed(() => {
  return editedIndex.value === -1 ? "Nueva modalidad" : "Editar modalidad";
});

const buttonSaveTitle = computed(() => {
  return editedIndex.value === -1 ? "Agregar" : "Guardar";
});

function editItem(item: any) {
  editedIndex.value = props.modalidades.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
}
function deleteItem(item: any) {
  editedIndex.value = props.modalidades.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialogDelete.value = true;
}
function deleteItemConfirm() {
  props.modalidades.value.splice(editedIndex.value, 1);
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

console.log(props.modalidades);
watch(props.modalidades, (val) => {
  console.log(val);
});
async function handleAddEditModalidad() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = {
    id: editedItem.value.id ?? null,
    modalidad: editedItem.value.modalidad,
  };
  const { data, error } = await useApiFetch("/modalidad", {
    method: method,
    body: body,
  });
  if (!error.value) {
    switch (method) {
      case "POST":
        {
          agregarRegistroModalidad(data.value);
        }
        break;
      case "PATCH":
        {
          const index = props.grupos.findIndex((obj) => obj.id === data.value?.id);
          actualizarRegistroModalidad(index, data.value);
        }
        break;
    }
    close();
  } else {
    console.error(error.value);
  }
}

async function eliminarModalidad(id: number) {
  const index = props.modalidades.findIndex((object) => object.id === id);
  const response = await useApiFetch(`/modalidad/${id}`, { method: "DELETE" });
  if (!response.error.value) {
    props.modalidades.splice(index, 1);
  } else {
    console.log("Algo salió mal");
  }
}

async function agregarRegistroModalidad(registro: any) {
  props.modalidades?.push({
    id: registro?.id,
    modalidad: registro?.modalidad,
  });
}

async function actualizarRegistroModalidad(index: number, registro: any) {
  props.modalidades[index].modalidad = registro?.modalidad;
}
</script>

<style></style>
