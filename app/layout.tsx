import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "SaliFusion — Salivary Imaging Decision Support",
  description: "Interactive multimodal workstation for independent ultrasound, sialography, CBCT review, adaptive recommendations, and structured reporting.",
  openGraph: {
    title: "SaliFusion — Salivary Imaging Decision Support",
    description: "Interactive multimodal medical-imaging workstation and deterministic educational demonstration.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "SaliFusion AI medical imaging proof of concept" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SaliFusion — Salivary Imaging Decision Support",
    description: "Independent ultrasound and ductal imaging workflows with explainable multimodal fusion.",
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
