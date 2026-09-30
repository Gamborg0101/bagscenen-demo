import type { MetadataRoute } from "next";
import { ORG } from "@/lib/org";

// Installable on phones ("Føj til hjemmeskærm"). No service worker on purpose:
// nothing personal is cached offline on the device.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bagscenen",
    short_name: "Bagscenen",
    description: `Vagtplanlægning for studentermedhjælpere på ${ORG.short}`,
    lang: "da",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
