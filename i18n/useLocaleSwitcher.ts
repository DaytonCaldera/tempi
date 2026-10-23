'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, type Locale } from '@/i18n/config';

/** Stores the locale in the cookie that i18n/request.ts reads (valid for a year). */
function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** The current locale, and a function that switches to another one by re-rendering the page with the new cookie. */
export function useLocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    saveLocale(newLocale);
    router.refresh();
  };

  return { locale, switchLocale };
}
