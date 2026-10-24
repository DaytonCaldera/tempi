import type { MetadataRoute } from "next";

/**
 * Web app manifest (/manifest.webmanifest): lets runners install the app on their phone's home screen and open it
 * full screen, straight on the runner page, which public/sw.js keeps working without connection.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Vitalliz",
        short_name: "Vitalliz",
        description: "Inventario en tiempo real",
        start_url: "/runner",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0a0a0c",
        theme_color: "#059669",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
    };
}
