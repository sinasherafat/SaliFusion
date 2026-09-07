import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "SaliFusion AI",
  description: "Multimodal AI-Assisted Assessment of Salivary Gland Diseases",
  openGraph: {
    title: "SaliFusion AI",
    description: "Multimodal AI-Assisted Assessment of Salivary Gland Diseases",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "SaliFusion AI medical imaging proof of concept" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SaliFusion AI",
    description: "Multimodal AI-Assisted Assessment of Salivary Gland Diseases",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
