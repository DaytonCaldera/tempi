<template>
  <!-- <v-container fluid> -->
    <!-- <v-combobox v-model="model" v-model:search="search" :hide-no-data="false" :items="options" hide-selected
      hint="Seleccione un encargado" persistent-hint small-chips> -->
    <!-- </v-combobox> -->
    <v-select :label="props.label" :items="options" item-title="label" item-value="id" variant="solo-inverted" :multiple="is_multiple"
       @update:modelValue="$emit('change',$event)" v-model="model">
      <template v-slot:no-data>
        <v-list-item>
          <v-list-item-title>
            No hay resultados para "<strong>{{ search }}</strong>".
          </v-list-item-title>
        </v-list-item>
      </template>
    </v-select>
  <!-- </v-container> -->
</template>

<script lang="ts" setup>
const props = defineProps(['id', 'label', 'emitChange','is_multiple'])
const { data:conductores } = await useApiFetch('/conductor')
const ids = ref(props.id != null ? props?.id.map((conductor)=>conductor.id):null);
const options = computed(() => {
  return conductores.value.map((conductor) => {
    return {
      id: conductor?.id,
      label: `${conductor?.publicador?.nombre} ${conductor?.publicador?.apellido1}`,
    };
  });
});
const is_multiple = ref(props.is_multiple ?? true);
const model = ref(ids)
const search = ref(null)

</script>

<style></style>