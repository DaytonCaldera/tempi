<template>
  <v-data-table :headers="headers" :items="grupos" :sort-by="[{ key: 'id', order: 'asc' }]">
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Grupos</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>
        <v-dialog v-model="dialog" max-width="65vw">
          <template v-slot:activator="{ props }">
            <v-btn color="primary" dark class="mb-2" v-bind="props">
              Nuevo grupo
            </v-btn>
          </template>
          <v-card>
            <v-card-title>
              <span class="text-h5">{{ formTitle }}</span>
            </v-card-title>

            <v-card-text>
              <v-container>
                <v-row>
                  <v-col cols="3" sm="3" md="3">
                    <v-text-field v-model="editedItem.id" v-if="editedIndex > 0" label="Id" disabled></v-text-field>
                  </v-col>
                  <v-col cols="9" sm="9" md="9">
                    <v-text-field v-model="editedItem.nombre" label="Nombre"></v-text-field>
                  </v-col>
                </v-row>
              </v-container>
            </v-card-text>

            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="blue-darken-1" variant="text" @click="close">
                Cancel
              </v-btn>
              <v-btn color="blue-darken-1" variant="text" @click="handleAddGrupo()">
                Save
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
        <v-dialog v-model="dialogDelete" max-width="500px">
          <v-card>
            <v-card-title class="text-h5">Are you sure you want to delete this item?</v-card-title>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="blue-darken-1" variant="text" @click="closeDelete">Cancelar</v-btn>
              <v-btn color="blue-darken-1" variant="text" @click="deleteItemConfirm">Agregar</v-btn>
              <v-spacer></v-spacer>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-toolbar>
    </template>
    <template v-slot:item.actions="{ item }">
      <v-icon size="small" class="me-2" @click="editItem(item)">
        mdi-pencil
      </v-icon>
      <v-icon size="small" @click="eliminarGrupo(item?.id)">
        mdi-delete
      </v-icon>
    </template>
    <!-- <template v-slot:no-data>
      <v-btn
        color="primary"
        @click="initialize"
      >
        Reset
      </v-btn>
    </template> -->
  </v-data-table>
</template>

<script lang="ts" setup>
const props = defineProps(['grupos'])

const headers = [
  {
    align: 'start',
    key: 'id',
    sortable: true,
    title: 'Id',
  },
  { key: 'nombre', title: 'Nombre' },
  { key: 'encargado', title: 'Encargado' },
  { key: 'auxiliar', title: 'auxiliar' },
  { key: 'actions', title: 'Acciones', align: 'end' },
]

const dialog = ref(false)
const dialogDelete = ref(false)
const editedIndex = ref(-1)
const editedItem = ref({
  id: 0,
  nombre: ''
})

const defaultItem = ref({
  id: 0,
  nombre: ''
})
const formTitle = computed(() => {
  return editedIndex.value === -1 ? 'Nuevo grupo' : 'Editar grupo'
})

function editItem(item: any) {
  editedIndex.value = props.grupos.indexOf(item)
  editedItem.value = Object.assign({}, item)
  dialog.value = true
}
function deleteItem(item: any) {
  editedIndex.value = props.grupos.indexOf(item)
  editedItem.value = Object.assign({}, item)
  dialogDelete.value = true
}
function deleteItemConfirm() {
  props.grupos.value.splice(editedIndex.value, 1)
  closeDelete()
}
function close() {
  dialog.value = false
  nextTick(() => {
    editedItem.value = Object.assign({}, defaultItem.value)
    editedIndex.value = -1
  })
}
function closeDelete() {
  dialogDelete.value = false
  nextTick(() => {
    editedItem.value = Object.assign({}, defaultItem.value)
    editedIndex.value = -1
  })
}
watch(dialog, val => {
  console.log(dialog);
  
  val || close()
})
const search = ref();
// console.log(props.grupos?.push({id:35,nombre:'desde nuxt props'}));



async function handleAddGrupo() {
  const { data, error } = await useApiFetch('/grupo', {
    method: 'POST',
    body: {
      nombre: editedItem.value.nombre
    }
  });
  if (!error.value) {
    props.grupos?.push({ id: data.value?.id, nombre: data.value?.nombre });
  }
}

async function eliminarGrupo(id: number) {
  const response = await useApiFetch(`/grupo/${id}`, { method: 'DELETE' });
  console.log(response);

  if (!response.error.value) {
    alert('Se ha eliminado el Grupo');
    await refreshNuxtData();
  } else {
    console.log("Algo salió mal");
  }
}
</script>

<style></style>