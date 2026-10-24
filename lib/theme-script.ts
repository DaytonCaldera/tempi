// Kept apart from lib/theme.ts (client hooks) so the server layouts can import the script

export const STORAGE_KEY = "theme";
export const CHANGE_EVENT = "themechange";

/**
 * Runs in <head> before the page paints: puts the resolved theme on <html> so there's no flash of the
 * wrong one, and keeps following the system while the preference is "system".
 */
export const THEME_SCRIPT = `(function(){try{
var d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");
function apply(){var t=null;try{t=localStorage.getItem("${STORAGE_KEY}")}catch(e){}
d.dataset.theme=t==="light"||t==="dark"?t:(m.matches?"dark":"light")}
apply();m.addEventListener("change",apply);window.addEventListener("${CHANGE_EVENT}",apply);
}catch(e){}})()`;
