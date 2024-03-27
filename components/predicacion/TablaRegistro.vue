<template>
  <v-data-table :headers="headers" :items="registros">
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title> Registro S-13 </v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-spacer></v-spacer>
        <v-btn @click="dialog = !dialog" color="primary" dark class="mb-2">
          <PredicacionModalAdminRegistro
            :dialog="dialog"
            @close="close"
            :registro="registro"
            @handle-record="guardarRegistro"
            @update-item="updateRegistro"
          />
          Nuevo registro
        </v-btn>
      </v-toolbar>
    </template>
    <template v-slot:item.territorio="{ item }">
      <span>{{ item?.territorio?.nombre }}</span>
    </template>
    <template v-slot:item.inicio="{ item }">
      <span>
        {{
          item.inicio
            ? new Date(item.inicio).toLocaleDateString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : ""
        }}
      </span>
    </template>
    <template v-slot:item.final="{ item }">
      <span>
        {{
          item.final
            ? new Date(item.final).toLocaleDateString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : ""
        }}
      </span>
    </template>
    <template v-slot:item.asignados="{ item }">
      <v-chip v-for="asignado in item.asignados">{{
        `${asignado.publicador.nombre}
        ${asignado.publicador.apellido1}`
      }}</v-chip>
    </template>
    <template v-slot:item.actions="{ item }">
      <v-btn @click="verRegistro(item)" color="primary" size="small">
        <v-icon icon="mdi-eye"></v-icon>
        <v-tooltip
          activator="parent"
          location="top"
          text="Ver detalles de registro"
        ></v-tooltip>
      </v-btn>
      <v-btn @click="administrarRegistro(item)" size="small">
        <v-icon icon="mdi-pencil"></v-icon>
        <v-tooltip activator="parent" location="top" text="Editar registro"></v-tooltip>
      </v-btn>
    </template>
  </v-data-table>
  <PredicacionModalVerRegistro :dialog="dialog_ver" @close="close" :registro="registro" />
</template>

<script lang="ts" setup>
const props = defineProps(["registros"]);
const emits = defineEmits(["actualizarRegistros"]);

const dialog = ref(false);
const dialog_ver = ref(false);
const headers = [
  { key: "periodo.id", title: "Periodo", width: "25px !important" },
  { key: "territorio", title: "Territorio", align: "start", sortable: true },
  { key: "inicio", title: "Inicio" },
  { key: "final", title: "Final" },
  { key: "dias", title: "Dias" },
  { key: "asignados", title: "Asignados" },
  { key: "actions", title: "Acciones", align: "end" },
];

function close() {
  dialog.value = false;
  dialog_ver.value = false;
  nextTick(() => {
    registro.value = Object.assign({}, default_registro.value);
    indexRegistro.value = -1;
  });
}

const registro = ref({
  id: -1,
  territorio: [],
  asignados: [],
  periodo: null,
  programado: "",
  dias: 0,
  inicio: "",
  final: "",
});

const default_registro = ref({
  id: -1,
  territorio: [],
  asignados: [],
  periodo: null,
  programado: "",
  dias: 0,
  inicio: "",
  final: "",
});

const indexRegistro = ref(-1);
function verRegistro(item: any) {
  indexRegistro.value = props.registros.indexOf(item);
  registro.value = Object.assign({}, item);
  dialog_ver.value = !dialog.value;
}

function administrarRegistro(item: any = null) {
  indexRegistro.value = item != null ? props.registros.indexOf(item) : -1;
  registro.value =
    item != null ? Object.assign({}, item) : Object.assign({}, default_registro.value);
  registro.value.inicio = formatDate(registro.value.inicio);
  registro.value.programado = formatDate(registro.value.programado);
  registro.value.final = formatDate(registro.value.final);
  dialog.value = true;
}

function updateRegistro(newItem: any) {
  registro.value = newItem;
}

function formatDate(dateString: string) {
  const dateObject = new Date(dateString);
  const formattedDate = dateObject.toISOString().slice(0, 10);
  return (dateString != "" && dateString != null) ? formattedDate : "";
}
//Con esta misma funcion se guarda y actualizan los registros
async function guardarRegistro() {
  const method = indexRegistro.value === -1 ? "POST" : "PATCH";
  const body = {
    id: registro.value.id ?? null,
    territorioId: registro.value.territorio?.id ?? registro.value.territorio ?? null,
    inicio: registro.value?.inicio ?? null,
    programado: registro.value?.programado ?? null,
    final: registro.value?.final ?? null,
    periodo: registro.value?.periodo ?? null,
    asignados:
      registro.value?.asignados.map((asignado) => asignado.id ?? asignado) ?? null,
  };
  const { data, error, status } = await useApiFetch("/registro", {
    method: method,
    body: body,
  });
  if (!error.value) {
    emits("actualizarRegistros", status);
    close();
  } else {
    console.error(error.value);
  }
}
</script>

<style scoped></style>
