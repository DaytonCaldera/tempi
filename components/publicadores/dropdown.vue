<template>
  <v-container fluid>
    <!-- <v-combobox v-model="model" v-model:search="search" :hide-no-data="false" :items="options" hide-selected
      hint="Seleccione un encargado" persistent-hint small-chips> -->
    <!-- </v-combobox> -->
    <v-select :label="props.label" :items="options" item-title="label" item-value="id" variant="solo-inverted"
      return-object @update:modelValue="$emit('change', $event)" v-model="model">
      <template v-slot:no-data>
        <v-list-item>
          <v-list-item-title>
            No hay resultados para "<strong>{{ search }}</strong>".
          </v-list-item-title>
        </v-list-item>
      </template>
    </v-select>
  </v-container>
</template>

<script lang="ts" setup>
const props = defineProps(['id', 'label', 'emitChange', 'avoid'])
const { data } = await useApiFetch('/publicador')

const options = computed(() => {
  if (props.avoid)
    return data.value
      .filter((persona) => !props.avoid.includes(persona.id)) // Filter based on avoid list
      .map((persona) => ({
        id: persona.id, // Access id directly (assumes non-null)
        label: `${persona.nombre} ${persona.apellido1}`, // Access properties directly
      })).filter(Boolean);
  else
    return data.value.map((persona) => ({
      id: persona.id, // Access id directly (assumes non-null)
      label: `${persona.nombre} ${persona.apellido1}`, // Access properties directly
    }))
});

const model = ref(props?.id ?? null)
const search = ref(null)
watch(model, val => {
})
</script>

<style></style>