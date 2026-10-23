/** Default SWR fetcher: GETs a URL and parses the JSON response. */
export const fetcher = (url: string) => fetch(url).then((res) => res.json());
