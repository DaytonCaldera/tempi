
import { createVuetify } from "vuetify";
import "@mdi/font/css/materialdesignicons.css";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { es } from 'vuetify/locale';
// import PerfectScrollbar from 'vue3-perfect-scrollbar';
// import VueApexCharts from 'vue3-apexcharts';
import VueTablerIcons from 'vue-tabler-icons';
import '@/scss/style.scss';
import {
  PurpleTheme,
} from "@/theme/LightTheme";
export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    locale: {
      locale: 'es',
      messages: { es }
    },
    directives,
    theme: {
      defaultTheme: "PurpleTheme",
      themes: {
        PurpleTheme,
      },
    },
  });
  nuxtApp.vueApp.use(vuetify);
  //   nuxtApp.vueApp.use(PerfectScrollbar);
  //   nuxtApp.vueApp.use(VueApexCharts);
  nuxtApp.vueApp.use(VueTablerIcons);
});

