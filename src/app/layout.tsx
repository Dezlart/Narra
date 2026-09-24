import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Narra — идеи, которые стоит прочитать",
  description: "Независимое пространство для историй о технологиях, дизайне и людях, которые меняют привычное.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body id="top">
        <a href="#main-content" className="skip-link">Перейти к содержимому</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
