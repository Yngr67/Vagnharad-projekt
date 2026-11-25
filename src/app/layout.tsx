import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Projektstöd",
  description: "Projektstöd för Vagnharad-uppdraget",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body className="antialiased">{children}</body>
    </html>
  );
}
