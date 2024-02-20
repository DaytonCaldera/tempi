<script setup lang="ts">
import { ref } from 'vue';
const checkbox = ref(true);
const form = ref({
  username: "dayton",
  password: "admin123",
});
const auth = useAuthStore();
async function handleLogin() {
  if (auth.isLoggedIn) return;
  const { error } = await auth.login(form.value);
  console.log(error);
  if(!error.value){
    navigateTo('/');
  }
}
</script>

<template>
    <v-row class="d-flex mb-3">
        <v-col cols="12">
            <v-label class="font-weight-bold mb-1">Usuario</v-label>
            <v-text-field v-model="form.username" variant="outlined" hide-details color="primary"></v-text-field>
        </v-col>
        <v-col cols="12">
            <v-label class="font-weight-bold mb-1">Contraseña</v-label>
            <v-text-field variant="outlined" v-model="form.password" type="password"  hide-details color="primary"></v-text-field>
        </v-col>
        <v-col cols="12" class="pt-0">
            <div class="d-flex flex-wrap align-center ml-n2">
                <v-checkbox v-model="checkbox"  color="primary" hide-details>
                    <template v-slot:label class="text-body-1">Remeber this Device</template>
                </v-checkbox>
                <div class="ml-sm-auto">
                    <NuxtLink to="/"
                        class="text-primary text-decoration-none text-body-1 opacity-1 font-weight-medium">Forgot
                        Password ?</NuxtLink>
                </div>
            </div>
        </v-col>
        <v-col cols="12" class="pt-0">
            <v-btn @click="handleLogin()" color="primary" size="large" block   flat>Sign in</v-btn>
        </v-col>
    </v-row>
</template>
