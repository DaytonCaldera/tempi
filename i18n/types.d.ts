import type { Locale } from "./config";

// Lets next-intl type useLocale()/getLocale() as one of the supported locales
declare module "next-intl" {
    interface AppConfig {
        Locale: Locale;
    }
}
