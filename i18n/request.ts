import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { auth } from '@/auth';
import { isTimeZone, TIMEZONE_COOKIE } from '@/lib/timezone';
import { defaultLocale, isLocale, LOCALE_COOKIE, matchAcceptLanguage, timeZone as defaultTimeZone } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  // The cookie set by LanguageSwitcher wins; first visits follow the browser's language
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : matchAcceptLanguage((await headers()).get('accept-language')) ?? defaultLocale;

  // Dates show in the time zone set in the account, else the browser's (lib/timezone.ts), else the default
  const accountTimeZone = (await auth())?.user?.timeZone;
  const browserTimeZone = cookieStore.get(TIMEZONE_COOKIE)?.value;
  const timeZone = isTimeZone(accountTimeZone) ? accountTimeZone
    : isTimeZone(browserTimeZone) ? browserTimeZone
    : defaultTimeZone;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
    timeZone,
  };
});
