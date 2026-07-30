import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import Nav from "@/components/nav";
import { PageWrapper } from "@/components/PageWrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NetrAI — AI Infrastructure Intelligence Platform",
  description: "AI-powered road damage and waste detection platform for smart civic infrastructure monitoring.",
  icons: {
    icon: "/netrai_icon.svg",
    apple: "/netrai_icon.png",
  },
  openGraph: {
    title: "NetrAI",
    description: "AI-powered road damage and waste detection.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="bg-canvas text-foreground font-sans antialiased">
        <ClerkProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
            <Nav />
            <PageWrapper>
              {children}
            </PageWrapper>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
