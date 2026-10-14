import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Catálogo EXCLUSIV", description: "Escolha peças, tamanhos e cores e envie seu pedido para a EXCLUSIV." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
