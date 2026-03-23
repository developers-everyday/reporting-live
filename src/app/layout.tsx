import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReportingLive - Premium AI Reporter",
  description: "ReportingLive lets you interact with verified news via an AI reporter.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#FF2E2E",
          colorBackground: "#1a1a24",
          colorText: "#FFFFFF",
          colorTextSecondary: "#c0c0cc",
          colorInputBackground: "#0f0f17",
          colorInputText: "#FFFFFF",
          colorNeutral: "#FFFFFF",
          borderRadius: "12px",
        },
      }}
    >
      <html lang="en">
        <body>
          <div className="container">
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
