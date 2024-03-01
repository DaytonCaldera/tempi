<template>
  <v-data-table
    :headers="headers"
    :items="grupos"
    :sort-by="[{ key: 'id', order: 'asc' }]"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Grupos</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>

        <v-btn color="primary" dark class="mb-2" @click="dialog = !dialog">
          <GruposModalGrupos
            @close="close"
            @handle-add-group="handleAddEditGroup"
            :dialog="dialog"
            :form-title="formTitle"
            :edited-index="editedIndex"
            :edited-item="editedItem"
            @update-item="updateEditedItem"
            :buttonSaveTitle="buttonSaveTitle"
            :usedPublicadores="usedPublicadores"
          ></GruposModalGrupos>
          Nuevo grupo
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
      <v-icon size="small" @click="eliminarGrupo(item?.id)"> mdi-delete </v-icon>
    </template>
  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(["grupos"]);
const emits = defineEmits(['actualizarGrupos']);
const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "nombre", title: "Nombre" },
  { key: "encargado", title: "Encargado" },
  { key: "auxiliar", title: "Auxiliar" },
  { key: "actions", title: "Acciones", align: "end" },
];

const dialog = ref(false);
const dialogDelete = ref(false);
const editedIndex = ref(-1);
const editedItem = ref({
  id: 0,
  nombre: "",
  encargado_id: null,
  encargado: null,
  auxiliar_id: null,
  auxiliar: null,
});

const defaultItem = ref({
  id: 0,
  nombre: "",
  encargado: null,
  auxiliar: null,
});
const formTitle = computed(() => {
  return editedIndex.value === -1 ? "Nuevo grupo" : "Editar grupo";
});

const buttonSaveTitle = computed(() => {
  return editedIndex.value === -1 ? "Agregar" : "Guardar";
});

const usedPublicadores = computed(()=>{
  const usedEncargados = props.grupos.map((g) => g.encargado_id).filter((v)=> v !=null);
  const usedAuxiliares = props.grupos.map((g) => g.auxiliar_id).filter((v)=> v !=null);
  return [...usedEncargados,...usedAuxiliares];
})

function editItem(item: any) {
  editedIndex.value = props.grupos.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
}
function deleteItem(item: any) {
  editedIndex.value = props.grupos.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialogDelete.value = true;
}
function deleteItemConfirm() {
  props.grupos.value.splice(editedIndex.value, 1);
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

console.log(props.grupos);
watch(props.grupos, (val) => {
  console.log(val);
});
async function handleAddEditGroup() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = {
    id: editedItem.value.id ?? null,
    nombre: editedItem.value.nombre,
    encargado: editedItem.value.encargado_id ?? null,
    auxiliar: editedItem.value.auxiliar_id ?? null,
  };
  const { data, error, status } = await useApiFetch("/grupo", {
    method: method,
    body: body,
  });
  if (!error.value) {
    emits('actualizarGrupos',status)
    close();
  } else {
    console.error(error.value);
  }
}

async function eliminarGrupo(id: number) {
  const index = props.grupos.findIndex((object) => object.id === id);
  const {error, status} = await useApiFetch(`/grupo/${id}`, { method: "DELETE" });
  if (!error.value) {
    emits('actualizarGrupos',status);
  } else {
    console.log("Algo salió mal");
  }
}

</script>

<style></style>
