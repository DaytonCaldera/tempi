<template>
  <v-dialog v-model="props.dialog" max-width="85vw" persistent>
    <v-card>
      <v-card-title>
        <span class="text-h5">Administrar registro</span>
      </v-card-title>

      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="1">
              <v-text-field disabled>
                {{ props.registro?.territorio?.id }}
              </v-text-field>
            </v-col>
            <v-col cols="5">
              <SharedDropdownTerritorios :id="[props.registro?.territorio]" :is_multiple="false" :label="'Territorio'"
                @change="updateData('territorio', $event)">
              </SharedDropdownTerritorios>
            </v-col>
            <!-- <v-col cols="3"></v-col> -->
            <v-col cols="6">
              <v-text-field v-model="props.registro.inicio" type="date" :label="'Iniciado el'" @update:model-value="updateDate('inicio', $event)"></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6">
              <SharedDropdownConductores :is_multiple="true" :id="props.registro?.asignados" :label="'Asignados'"
                @change="updateData('asignados', $event)">
              </SharedDropdownConductores>
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="programado" type="date" :label="'Programado para'" @update:model-value="updateDate('programado', $event)"></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6">
              <!-- <v-text-field readonly :label="'Periodo'" :v-bind="props.registro?.periodo?.id"></v-text-field> -->
              <SharedDropdownPeriodo :id="props.registro.periodo?.id ?? 0" :label="'Periodo'" @change="updateData('periodo',$event)" />
            </v-col>
            <v-col cols="6"  v-if="props.registro?.id > -1">
              <v-text-field v-model="props.registro.final" type="date" :label="'Finalizado el'" @update:model-value="updateDate('final', $event)"></v-text-field>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" prepend-icon="mdi-window-close" variant="text" @click="close">
          Cerrar
        </v-btn>
        <v-btn prepend-icon="mdi-content-save" @click="$emit('handleRecord')"> Guardar </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
const props = defineProps(["dialog", "registro"]);
const emits = defineEmits(["update-item", 'close']);

console.log(props.registro);

// const inicio = ref('');
const inicio = ref(props.registro?.inicio);
const final = ref(props.registro?.final);
const programado = ref(props.registro?.programado);

watch(inicio, val => {
  console.log(inicio, val);
})

watch(props.registro, (newVal, oldVal) => {
  if (newVal?.inicio && newVal.inicio !== oldVal?.inicio) {
    inicio.value = formatDate(newVal.inicio);
  }
  if (newVal?.final && newVal.final !== oldVal?.final) {
    final.value = formatDate(newVal.final);
  }
  if (newVal?.programado && newVal.programado !== oldVal?.programado) {
    programado.value = formatDate(newVal.programado);
  }
});

const selectedDate = ref("");
function updateDate(field: string, value: string) {
  selectedDate.value = value;
  updateData(field, value);
}

function updateData(field: any, value: any) {
  const updatedItem = { ...props.registro, [field]: value };
  emits("update-item", updatedItem);
}

function formatDate(dateString: string) {
  const dateObject = new Date(dateString);
  const formattedDate = dateObject.toISOString().slice(0, 10);
  return (dateString != "" && dateString != null) ? formattedDate : "";
}

function close(): void {
  inicio.value = '';
  final.value = '';
  programado.value = '';
  emits('close');
}
</script>

<style></style>
