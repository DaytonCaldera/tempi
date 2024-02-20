<script lang="ts" setup>
import { useAuthStore } from "~/stores/useAuthStore";
definePageMeta({
  layout: 'blank',
  middleware: ['guest']
})
const form = ref({
  username: "dayton",
  password: "admin123",
});

const auth = useAuthStore();
async function handleLogin() {
  if (auth.isLoggedIn) return;
  const { error } = await auth.login(form.value);
  console.log(error);
}
</script>

<template>
  <form @submit.prevent="handleLogin">
    <label>
      Email
      <input v-model="form.username" type="text" />
    </label>
    <label>
      Password
      <input v-model="form.password" type="password" />
    </label>

    <button>Login</button>
  </form>
</template>

<style scoped></style>
