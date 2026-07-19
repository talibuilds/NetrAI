import type { Metadata, Viewport } from "next";
import { Epilogue, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import Nav from "@/components/nav";
import "./globals.css";

const epilogue = Epilogue({
  subsets: ["latin"],
  weight: ["900"],
  style: ["normal", "italic"],
  variable: "--font-epilogue",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
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
    <html lang="en" className={`${epilogue.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <body className="bg-canvas text-foreground font-sans antialiased">
        <ClerkProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
            <Nav />
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
