import type { UseFetchOptions } from 'nuxt/app'

export function useApiFetch<T>(path: string, options: UseFetchOptions<T> = {}) {
  let errors = [];
  const config = useRuntimeConfig()
  try {


    let headers: any = {
      accept: 'application/json'
    }
    const { token } = useAuthState()
    if (token) {
      headers['Authorization'] = token.value;
    }
    if (process.server) {
      headers = {
        ...headers,
        ...useRequestHeaders(["referer", "cookie"])
      }
    }
    const response = useFetch(config.public.NUXT_BASE_URL + path, {
      credentials: 'include',
      ...options,
      headers: {
        ...headers
      },
      onResponseError({ request, response, options, error }) {
        return handleError(response.status);
      },
    });
    return response;
  } catch (err) {
    errors.push(err)
    console.log('Error: ' + err);
    throw err;
  }
}

function handleError(error: number) {
  switch (error) {
    case 401: {
      return {
        code: error,
        message: 'Debe volver a autenticarse'
      }
    } break;
  }

}