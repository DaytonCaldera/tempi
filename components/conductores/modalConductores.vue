<template>
  <v-dialog v-model="props.dialog" max-width="65vw" persistent>
    <v-card>
      <v-card-title>
        <span class="text-h5">{{ props.formTitle }}</span>
      </v-card-title>

      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="3" sm="3" md="3">
              <v-text-field v-model="props.editedItem.id" v-if="props.editedItem.id > 0" label="Id"
                disabled></v-text-field>
            </v-col>
            <v-col cols="9" sm="9" md="9">
              <PublicadoresDropdown :id="props.editedItem.publicador.id" :label="'Seleccione un publicador'"
                @change="change('publicador', $event)" />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <SharedDropdownDias :id="props.editedItem.dias" :label="'Seleccione los dias disponibles'"
                @change="updateData('dias', $event)" />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <SharedDropdownModalidad :id="props.editedItem.modalidad" :label="'Seleccione la modalidad que dispone'"
                @change="updateData('modalidad', $event)" />
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="$emit('close')">
          Cancelar
        </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="$emit('handleAddConductor')">
          {{ buttonSaveTitle }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
// import {DropdownDias} from '../shared/dropdownDias'
const props = defineProps([
  "editedItem",
  "formTitle",
  "dialog",
  "editedIndex",
  "buttonSaveTitle",
]);

const emits = defineEmits(["update-item"]);
function updateData(field: any, value: any) {
  const updatedItem = { ...props.editedItem, [field]: value };
  emits("update-item", updatedItem);
}
function change(field: any, value: any) {
  const updatedItem = {
    ...props.editedItem,
    [field]: { id: value?.id, nombre: value?.nombre },
  };
  emits("update-item", updatedItem);
}
function changeDias(value: any) {
  emits("update-item",)

}
</script>

<style></style>
