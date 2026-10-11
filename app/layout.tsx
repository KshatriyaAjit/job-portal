import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "@/components/Navbar"; // 👈 Import this

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Insider Jobs",
  description: "Find your dream job",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Navbar /> 
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}