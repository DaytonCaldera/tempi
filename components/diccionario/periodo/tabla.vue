<template>
  <v-data-table
    :headers="headers"
    :items="periodos"
    :sort-by="[{ key: 'id', order: 'asc' }]"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Periodos</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>

        <v-btn color="primary" dark class="mb-2" @click="dialog = !dialog">
          <DiccionarioPeriodoModal
            @close="close"
            @handle-add-modalidad="handleAddEditPeriodo"
            :dialog="dialog"
            :form-title="formTitle"
            :edited-index="editedIndex"
            :edited-item="editedItem"
            @update-item="updateEditedItem"
            :buttonSaveTitle="buttonSaveTitle"
          ></DiccionarioPeriodoModal>
          Nuevo Periodo
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
    <template v-slot:item.inicio="{ item }">
      <span>
        {{
          item.inicio
            ? new Date(item.inicio).toLocaleDateString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : ""
        }}
      </span>
    </template>
    <template v-slot:item.final="{ item }">
      <span>
        {{
          item.final
            ? new Date(item.final).toLocaleDateString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : ""
        }}
      </span>
    </template>
    <template v-slot:item.actions="{ item }">
      <v-icon size="small" class="me-2" @click="editItem(item)"> mdi-pencil </v-icon>
      <v-icon size="small" @click="eliminarPeriodo(item?.id)"> mdi-delete </v-icon>
    </template>
  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(["periodos"]);

const headers = [
  {
    align: "start",
    key: "id",
    sortable: true,
    title: "Id",
  },
  { key: "inicio", title: "Inicio" },
  { key: "final", title: "Final" },
  { key: "actions", title: "Acciones", align: "end" },
];

const dialog = ref(false);
const dialogDelete = ref(false);
const editedIndex = ref(-1);
const editedItem = ref({
  id: 0,
  inicio: "",
  final: "",
});

const defaultItem = ref({
  id: 0,
  inicio: "",
  final: "",
});
const formTitle = computed(() => {
  return editedIndex.value === -1 ? "Nuevo periodo" : "Editar periodo";
});

const buttonSaveTitle = computed(() => {
  return editedIndex.value === -1 ? "Agregar" : "Guardar";
});

function editItem(item: any) {
  editedIndex.value = props.periodos.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
}
function deleteItem(item: any) {
  editedIndex.value = props.periodos.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialogDelete.value = true;
}
function deleteItemConfirm() {
  props.periodos.value.splice(editedIndex.value, 1);
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

console.log(props.periodos);
watch(props.periodos, (val) => {
  console.log(val);
});
async function handleAddEditPeriodo() {
  const method = editedIndex.value === -1 ? "POST" : "PATCH";
  const body = {
    id: editedItem.value.id ?? null,
    inicio: editedItem.value.inicio,
    final: editedItem.value.final,
  };
  const { data, error } = await useApiFetch("/periodo", {
    method: method,
    body: body,
  });
  if (!error.value) {
    switch (method) {
      case "POST":
        {
          agregarRegistroPeriodo(data.value);
        }
        break;
      case "PATCH":
        {
          const index = props.periodos.findIndex((obj) => obj.id === data.value?.id);
          actualizarRegistroPeriodo(index, data.value);
        }
        break;
    }
    close();
  } else {
    console.error(error.value);
  }
}

async function eliminarPeriodo(id: number) {
  const index = props.periodos.findIndex((object) => object.id === id);
  const response = await useApiFetch(`/modalidad/${id}`, { method: "DELETE" });
  if (!response.error.value) {
    props.periodos.splice(index, 1);
  } else {
    console.log("Algo salió mal");
  }
}

async function agregarRegistroPeriodo(registro: any) {
  props.periodos?.push({
    id: registro?.id,
    modalidad: registro?.modalidad,
  });
}

async function actualizarRegistroPeriodo(index: number, registro: any) {
  props.periodos[index].inicio = registro?.inicio;
  props.periodos[index].final = registro?.final;
}
</script>

<style></style>
