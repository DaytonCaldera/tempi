import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  // Buscamos la cookie que setea el middleware
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'es';

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
    timeZone: 'America/Costa_Rica' // Seteamos tu zona horaria por defecto
  };
});