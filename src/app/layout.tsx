import type { Metadata } from "next";
import "./globals.css";
import { themeScript } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: { default: "Motor de Estimativa", template: "%s · Motor de Estimativa" },
  description: "Estimativa de esforço e custos de desenvolvimento, com e sem IA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o script abaixo põe a classe `dark` no <html> antes da hidratação.
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
