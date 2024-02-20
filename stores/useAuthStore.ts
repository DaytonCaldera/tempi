import { defineStore } from 'pinia'
type User = {
  id: number;
  username: string;
}
type Credentials = {
  username: string;
  password: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => !!user.value)

  async function logout() {
    await useApiFetch("/auth/logout", { method: "POST" });
    user.value = null;
    navigateTo("/auth/login");
  }

  async function login(credentials: Credentials) {
    const login = await useApiFetch('/auth/login', {
      method: 'POST',
      body: credentials
    });
    await fetchUser();
    return login;
  }

  async function fetchUser() {
    const { data, error } = await useApiFetch("/auth/profile");
    user.value = data.value as User;
  }

  return { user, login, fetchUser, isLoggedIn, logout };
})
