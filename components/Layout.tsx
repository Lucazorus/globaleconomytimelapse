"use client";
import React, { ReactNode, useState, useEffect } from "react";
import Script from "next/script";
import { Inter } from "next/font/google";
import { useRive, Layout as RiveLayout, Fit, Alignment } from "@rive-app/react-canvas";
import { useLang } from "../lib/LangContext";
import type { Lang } from "../lib/i18n";
const inter = Inter({ subsets: ["latin"] });

// Hook custom pour récupérer la largeur de la fenêtre
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}

// Typage des props
interface LayoutProps {
  children: ReactNode;
  title?: string;
}

// Composant LogoHeader (ne touche pas)
function LogoHeader() {
  const { RiveComponent } = useRive({
    src: "/images/logo.riv",
    stateMachines: "SMLogoStatic",
    autoplay: true,
    layout: new RiveLayout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  });
  return (
    <a
      href="https://www.lucasmassoni.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="group"
      style={{
        display: "inline-block",
        borderRadius: 12,
        overflow: "hidden",
        verticalAlign: "middle",
      }}
      title="Voir le site de Lucas Massoni"
    >
      <div
        className="transition-all duration-200 group-hover:scale-105 group-active:scale-95 group-hover:shadow-lg"
        style={{
          width: 40,
          height: 40,
          display: "block",
          background: "rgba(28,36,41,0.76)",
          borderRadius: 12,
        }}
      >
        <RiveComponent style={{ width: 40, height: 40, display: "block" }} />
      </div>
    </a>
  );
}

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "en", flag: "🇬🇧", label: "EN" },
];

const Layout = ({ children, title }: LayoutProps) => {
  const width = useWindowWidth();
  const isMobile = width <= 600;
  const { lang, setLang } = useLang();

  return (
    <>
      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-4VCMFMJZDS"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-4VCMFMJZDS');
        `}
      </Script>
      <div
        className={inter.className}
        style={{
          minHeight: "100dvh",
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          width: "100vw",
          overflow: "hidden",
        }}
      >
        {/* Balise <title> si besoin */}
        {title && (
          <head>
            <title>{title}</title>
          </head>
        )}
        <header style={{ flexShrink: 0, background: "#1a2327", padding: "8px 24px 0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo + titre */}
          <div style={{ display: "inline-flex", alignItems: "stretch" }}>
            <LogoHeader />
            <span
              style={{
                marginLeft: 16,
                fontSize: isMobile ? 15 : 25,
                fontWeight: 400,
                color: "#e9eef4",
                lineHeight: isMobile ? "28px" : "40px",
                display: "inline-block",
                verticalAlign: "middle",
                whiteSpace: "nowrap",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                maxWidth: isMobile ? "calc(100vw - 150px)" : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Global Economy Timelapse
            </span>
          </div>

          {/* Toggle langue */}
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {LANGS.map(({ code, flag, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  background: lang === code ? "rgba(255,255,255,0.15)" : "transparent",
                  border: lang === code ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                  borderRadius: 6,
                  color: lang === code ? "#fff" : "rgba(255,255,255,0.45)",
                  fontSize: isMobile ? 11 : 13,
                  padding: isMobile ? "2px 5px" : "3px 8px",
                  cursor: "pointer",
                  lineHeight: "20px",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {flag} {!isMobile && label}
              </button>
            ))}
          </div>
        </header>
        <main
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "center",
            overflow: "hidden",
            background: "#1a2327",
          }}
        >
          {children}
        </main>
       <footer
  style={{
    flexShrink: 0,
    width: "100%",
    borderTop: "1px solid #283030",
    padding: "12px 0 10px 0",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "12px",
    opacity: 0.80,
    background: "#1a2327",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <div>
    Made with <span style={{ color: "#fb7185" }}>♥</span> by{" "}
    <a
      href="https://www.linkedin.com/in/lucas-massoni/"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "#6FAF84",
        textDecoration: "underline",
        transition: "color 0.3s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#559C6B")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#6FAF84")}
    >
      Lucas Massoni
    </a>{" "}
    - 2025
    &nbsp;|&nbsp;
    Data source:{" "}
    <a
      href="https://www.worldbank.org/ext/en/home/"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "#52a6df",
        textDecoration: "underline",
        transition: "color 0.3s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#559C6B")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#6FAF84")}
    >
      worldbank.org
    </a>
  </div>
</footer>

      </div>
    </>
  );
};

export default Layout;
