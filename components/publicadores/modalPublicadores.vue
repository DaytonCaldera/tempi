<template>
  <v-dialog v-model="props.dialog" max-width="65vw" persistent>
    <v-card>
      <v-card-title>
        <span class="text-h5">{{ props.formTitle }}</span>
      </v-card-title>

      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="2" sm="2" md="2">
              <v-text-field
                :rules="[rules.required]"
                v-model="props.editedItem.id"
                v-if="props.editedItem.id > 0"
                label="Id"
                disabled
              ></v-text-field>
            </v-col>
            <v-col cols="5" sm="5" md="5">
              <v-text-field
                v-model="props.editedItem.nombre"
                label="Nombre"
                @change="updateData('nombre', $event.target.value)"
              ></v-text-field>
            </v-col>
            <v-col cols="5" sm="5" md="5">
              <v-text-field
                v-model="props.editedItem.apellido1"
                label="Apellido 1"
                @change="updateData('apellido1', $event.target.value)"
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <GruposDropdown
                :id="props.editedItem.grupo_id"
                :label="'Seleccione un grupo'"
                @change="change('grupo', $event)"
              >
              </GruposDropdown>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="$emit('close')">
          Cancelar
        </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="$emit('handleAddPublicador')">
          {{ buttonSaveTitle }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
const props = defineProps([
  "editedItem",
  "formTitle",
  "dialog",
  "editedIndex",
  "buttonSaveTitle",
]);

const emits = defineEmits(["update-item"]);
const rules = {
  required: (value) => !!value || "Nombre de publicador requerido",
};
function updateData(field: any, value: any) {
  const updatedItem = { ...props.editedItem, [field]: value };
  emits("update-item", updatedItem);
}
function change(field: any, value: any) {
  const updatedItem = {
    ...props.editedItem,
    [field]: value.label,
    [field + "_id"]: value.id,
  };
  emits("update-item", updatedItem);
}
</script>

<style></style>
