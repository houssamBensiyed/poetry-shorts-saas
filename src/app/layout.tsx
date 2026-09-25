import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ThemeProvider, type Theme } from "@/components/theme/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Poetry Shorts",
    template: "%s · Poetry Shorts",
  },
  description:
    "Turn spoken poetry into vertical videos. Channel management, voice queue, and automated rendering.",
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("ps-theme");if(t!=="light"&&t!=="dark"&&t!=="system"){t="system";}var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";r.dataset.theme=t;}catch(e){}})();`;

function initialTheme(): Theme {
  const value = cookies().get("ps-theme")?.value;
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = initialTheme();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={theme === "dark" ? "dark" : undefined}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
