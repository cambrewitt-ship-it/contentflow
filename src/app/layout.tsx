import type { Metadata } from "next";
import "./globals.css";
import "../styles/glassmorphism.css";
import { UIThemeProvider } from "contexts/UIThemeContext";

export const metadata: Metadata = {
  title: "Content Manager - AI-Powered Social Media Management",
  description: "Upload content, generate captions with AI, and schedule posts across all platforms. Built specifically for marketing agencies managing multiple clients.",
  keywords: "social media management, AI captions, marketing agencies, content scheduling",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <UIThemeProvider>
          {children}
        </UIThemeProvider>
      </body>
    </html>
  );
}
