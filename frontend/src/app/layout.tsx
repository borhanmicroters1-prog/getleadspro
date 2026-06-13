import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/utils/theme";

export const metadata: Metadata = {
  title: "GetLeads — Zero Dollar AI Email Outreach SaaS",
  description: "Scrape leads from Google Maps and Facebook Ads, generate personalized cold emails with AI, and launch campaigns directly via Gmail & Brevo with zero platform fees.",
  keywords: "email outreach, cold email, lead generation, google maps scraper, facebook ads library scraper, AI personalization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <div className="gradient-bg" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
