import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE, matchAcceptLanguage, timeZone } from './config';

export default getRequestConfig(async () => {
  // The cookie set by LanguageSwitcher wins; first visits follow the browser's language
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : matchAcceptLanguage((await headers()).get('accept-language')) ?? defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
    timeZone,
  };
});
