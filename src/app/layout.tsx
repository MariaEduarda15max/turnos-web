import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fuentes guardadas en el repo (src/app/fonts, licencia OFL 1.1) en vez
// de next/font/google: con Google, cada build las descarga de internet y
// si esa descarga falla el deploy se rompe ("Module not found: Can't
// resolve '@vercel/turbopack-next/internal/font/google/font?…'", 3/11).
// Son las versiones variables (subset latin, alcanza para español).
const fraunces = localFont({
  src: "./fonts/fraunces-latin-variable.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "turnos-web",
  description: "Gestión de turnos para negocios — panel del negocio y reserva para clientes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${fraunces.variable} ${inter.variable} font-sans bg-bosque-50 text-bosque-900`}>
        {children}
      </body>
    </html>
  );
}
