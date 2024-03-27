<template>
  <v-dialog v-model="props.dialog" max-width="65vw" persistent>
    <v-card>
      <v-card-title>
        <span class="text-h5">Detalles del registro</span>
      </v-card-title>

      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="1">
              <span>
                {{ props.registro.territorio.id }}
              </span>
            </v-col>
            <v-col cols="5">
              <span>
                {{ props.registro.territorio.nombre }}
              </span>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="$emit('close')">
          Cerrar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
const props = defineProps(['registro', 'dialog']);
console.log(props.registro);
</script>

<style>

</style>