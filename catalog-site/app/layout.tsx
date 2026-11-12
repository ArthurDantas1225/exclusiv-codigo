import type { Metadata, Viewport } from "next";
import { Funnel_Sans, Lora } from "next/font/google";
import "./globals.css";
export const metadata: Metadata = { title: "Catálogo EXCLUSIV", description: "Escolha peças, tamanhos e cores e envie seu pedido para a EXCLUSIV." };
const funnel = Funnel_Sans({ subsets: ["latin"], variable: "--font-funnel", display: "swap" });
const lora = Lora({ subsets: ["latin"], weight: ["500"], variable: "--font-lora", display: "swap" });
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#141414" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR" className={`${funnel.variable} ${lora.variable}`}><body>{children}</body></html>; }
