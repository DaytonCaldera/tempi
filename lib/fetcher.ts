/**
 * Default SWR fetcher: GETs a URL and parses the JSON response.
 * Throws on error responses, so SWR keeps the last good data instead of replacing it with `{ error }`.
 */
export const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`);
    return res.json();
};

/**
 * How often stock pages re-fetch to show changes made by other people. Your own changes show right away
 * (optimistic updates), and SWR also re-fetches when the tab regains focus and stops while it's hidden.
 */
export const STOCK_REFRESH_INTERVAL = 10_000;
