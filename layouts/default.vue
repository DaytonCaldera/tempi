<style scoped></style>


<script setup lang="ts">
import { RouterView } from 'vue-router';
const title = ref("Tempi - Generador de programas de predicacion");

useHead({
    meta: [{ content: title }],
    title: title
});
definePageMeta({
    middleware: 'auth'
})
</script>

<template>
    <v-locale-provider>
        <v-app>
            <LayoutFullMain />
            <v-main>
                <v-container fluid class="page-wrapper">
                    <div class="maxWidth">
                        <RouterView />
                    </div>
                </v-container>
            </v-main>
        </v-app>
    </v-locale-provider>
</template>
