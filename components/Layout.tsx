"use client";
import React, { ReactNode, useState, useEffect } from "react";
import Head from "next/head";
import Script from "next/script";
import { Archivo, Share_Tech_Mono } from "next/font/google";
import { useRive, Layout as RiveLayout, Fit, Alignment } from "@rive-app/react-canvas";
import { useLang } from "../lib/LangContext";
import type { Lang } from "../lib/i18n";

// Archivo variable : l'axe de chasse (wdth) porte les titres élargis.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// Share Tech Mono : réservée aux données (année, chiffres).
const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  display: "swap",
});

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
          background: "var(--bg-2)",
          borderRadius: 10,
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
        className={`${archivo.variable} ${shareTechMono.variable}`}
        style={{
          minHeight: "100dvh",
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          width: "100vw",
          overflow: "hidden",
          fontFamily: "var(--font-archivo), 'Archivo', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {/* Balise <title> si besoin */}
        {title && (
          <Head>
            <title>{title}</title>
          </Head>
        )}
        <header
          style={{
            flexShrink: 0,
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            padding: isMobile ? "8px 16px" : "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* Logo + titre */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: isMobile ? 10 : 14, minWidth: 0 }}>
            <LogoHeader />
            <span
              style={{
                fontSize: isMobile ? 15 : 19,
                fontWeight: 600,
                color: "var(--ink)",
                lineHeight: 1.2,
                display: "inline-block",
                whiteSpace: "nowrap",
                letterSpacing: "-0.015em",
                fontStretch: "108%",
                maxWidth: isMobile ? "calc(100vw - 150px)" : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Global Economy Timelapse
            </span>
            {!isMobile && (
              <>
                <span aria-hidden="true" style={{ width: 1, height: 16, background: "var(--line-strong)" }} />
                <span style={{ fontSize: 13.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  1960 → {new Date().getFullYear()}
                </span>
              </>
            )}
          </div>

          {/* Toggle langue — FR | EN sobre */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {LANGS.map(({ code, label }, i) => (
              <React.Fragment key={code}>
                {i > 0 && (
                  <span aria-hidden="true" style={{ width: 1, height: 12, background: "var(--line-strong)" }} />
                )}
                <button
                  onClick={() => setLang(code)}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    color: lang === code ? "var(--ink)" : "var(--muted)",
                    fontSize: isMobile ? 11 : 12.5,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    padding: isMobile ? "2px 5px" : "3px 7px",
                    cursor: "pointer",
                    lineHeight: "20px",
                    transition: "color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              </React.Fragment>
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
            background: "var(--bg)",
          }}
        >
          {children}
        </main>
        <footer
          style={{
            flexShrink: 0,
            width: "100%",
            borderTop: "1px solid var(--line)",
            padding: "11px 0 10px 0",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: "12px",
            background: "var(--bg-2)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div>
            Made with <span style={{ color: "var(--sage-bright)" }}>♥</span> by{" "}
            <a
              href="https://www.linkedin.com/in/lucas-massoni/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--body)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sage-bright)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--body)")}
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
                color: "var(--body)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sage-bright)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--body)")}
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
