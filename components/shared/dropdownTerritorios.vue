<template>
  <v-container fluid>
    <!-- <v-combobox v-model="model" v-model:search="search" :hide-no-data="false" :items="options" hide-selected
      hint="Seleccione un encargado" persistent-hint small-chips> -->
    <!-- </v-combobox> -->
    <v-select :label="props.label" :items="options" item-title="label" item-value="id" variant="solo-inverted" multiple
       @update:modelValue="$emit('change',$event)" v-model="model">
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
const props = defineProps(['id', 'label', 'emitChange'])
const { data:territorios } = await useApiFetch('/territorio')
const ids = ref(props?.id.map((territorio)=>territorio.id))
const options = computed(() => {
  return territorios.value.map((territorio) => {
    return {
      id: territorio?.id,
      label: territorio?.nombre,
    };
  });
});

const model = ref(ids)
const search = ref(null)

</script>

<style></style>