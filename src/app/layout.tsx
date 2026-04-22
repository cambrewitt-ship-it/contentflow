import type { Metadata } from "next";
import { Poppins, Noto_Sans, Montserrat } from "next/font/google";
import "./globals.css";
import "../styles/glassmorphism.css";
import { UIThemeProvider } from "../contexts/UIThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import ConditionalCreditsProvider from "./ConditionalCreditsProvider";
import { GoogleTagManager, GoogleTagManagerNoScript } from "../components/GoogleTagManager";

// Validate environment variables on server startup
import "../lib/validateEnv";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins"
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "700"]
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: {
    default: "Content Manager — AI Social Media Management for Marketing Agencies",
    template: "%s | Content Manager",
  },
  description: "Content Manager helps marketing agencies generate on-brand content with AI, schedule across every platform, and streamline client approvals — all in one place. Start free.",
  keywords: "social media management software, AI social media tool, marketing agency software, content scheduling, social media scheduler, AI content generation, brand voice AI, social media management for agencies",
  metadataBase: new URL("https://content-manager.io"),
  openGraph: {
    type: "website",
    siteName: "Content Manager",
    title: "Content Manager — AI Social Media Management for Marketing Agencies",
    description: "Generate on-brand content with AI, schedule across every platform, and manage client approvals — all in one place.",
    url: "https://content-manager.io",
    images: [
      {
        url: "/cm-logo.png",
        width: 1200,
        height: 630,
        alt: "Content Manager — AI Social Media Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Content Manager — AI Social Media Management for Marketing Agencies",
    description: "Generate on-brand content with AI, schedule across every platform, and manage client approvals — all in one place.",
    images: ["/cm-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // GTM ID - using the actual ID from Google
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-KL3PR53B';
  
  return (
    <html lang="en">
      <body className={`${poppins.className} ${montserrat.variable} antialiased`}>
        <GoogleTagManager gtmId={gtmId} />
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
