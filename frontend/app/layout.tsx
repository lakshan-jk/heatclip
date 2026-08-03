import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const TITLE = "HeatClip — Turn your best YouTube moments into Shorts";
const DESC =
  "HeatClip reads a video's most-replayed heatmap and turns the hottest moments into ready-to-post vertical Shorts. Paste a link, get clips.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: "website", siteName: "HeatClip" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Optional privacy-friendly analytics (Plausible/Umami-compatible). Off unless set.
  const analyticsDomain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  const analyticsSrc =
    process.env.NEXT_PUBLIC_ANALYTICS_SRC || "https://plausible.io/js/script.js";

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var q=new URLSearchParams(location.search).get('theme');var t=q||localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}`,
          }}
        />
        {analyticsDomain && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script defer data-domain={analyticsDomain} src={analyticsSrc} />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
