import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import HtmlLangSetter from "@/components/HtmlLangSetter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nova Expenses",
  description: "Track your expenses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <AuthProvider>
          <LanguageProvider>
            <HtmlLangSetter />
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
