<template>
  <v-text-field v-model="formattedDate" :label="props.label" readonly>
    <template #append>
      <v-btn @click="openDatePicker" icon="mdi-calendar"> </v-btn>
    </template>
  </v-text-field>
  <v-menu
    ref="menu"
    v-model="menuOpen"
    transition="scale-transition"
    offset-y
    style="justify-content: center; align-items: center"
    :close-on-content-click="false"
  >
    <v-date-picker
      v-model="selectedDate"
      type="date"
      show-adjacent-months
      @update:model-value="$emit('updateValue',$event)"
    ></v-date-picker>
  </v-menu>
</template>

<script lang="ts" setup>
const props = defineProps(['date','label']);
const emits = defineEmits(["updatedValue"]);
const selectedDate = ref(props.date || null);
const formattedDate = ref(props.date ? new Date(props.date).toLocaleDateString() : null );

const menuOpen = ref(false);
function openDatePicker() {
  menuOpen.value = true;
}


</script>

<style></style>
