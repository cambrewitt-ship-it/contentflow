import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import "../styles/glassmorphism.css";
import { UIThemeProvider } from "../contexts/UIThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import ConditionalCreditsProvider from "./ConditionalCreditsProvider";
import { GoogleTagManager, GoogleTagManagerNoScript } from "../components/GoogleTagManager";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins"
});

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
  // Get GTM ID from environment variable
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || '';
  
  return (
    <html lang="en">
      <head>
        <GoogleTagManager gtmId={gtmId} />
      </head>
      <body className={`${poppins.className} antialiased`}>
        <GoogleTagManagerNoScript gtmId={gtmId} />
        <AuthProvider>
          <ConditionalCreditsProvider>
            <UIThemeProvider>
              {children}
            </UIThemeProvider>
          </ConditionalCreditsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
