<template>
  <v-row justify="end">
    <v-col cols="auto">
      <v-dialog transition="dialog-bottom-transition" width="25vw">
        <template v-slot:activator="{ props }">
          <v-btn color="primary" v-bind="props">{{ openText }}</v-btn>
        </template>
        <template v-slot:default="{ isActive }">
          <slot />
        </template>
      </v-dialog>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
defineProps(['openText'])
</script>