import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Verifica",
    short_name: "Verifica",
    description: "Gestão operacional, atendimento, caixa, marketing e presença digital para negócios locais.",
    id: "/verifica/login",
    start_url: "/verifica/login",
    scope: "/verifica/",
    display: "standalone",
    background_color: "#0D1117",
    theme_color: "#0D1117",
    icons: [
      {
        src: "./icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "./icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
