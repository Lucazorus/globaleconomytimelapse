"use client";
import React, { ReactNode, useState, useEffect } from "react";
import Script from "next/script";
import { Inter } from "next/font/google";
import { useRive, Layout as RiveLayout, Fit, Alignment } from "@rive-app/react-canvas";
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

const Layout = ({ children, title }: LayoutProps) => {
  const width = useWindowWidth();
  const isMobile = width <= 600;

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
        <header style={{ flexShrink: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "stretch", background: "#1a2327", padding: "8px 24px 0 24px" }}>
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
                maxWidth: isMobile ? "calc(100vw - 90px)" : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Global Economy Timelapse
            </span>
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
          }}
        >
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
        </footer>
      </div>
    </>
  );
};

export default Layout;
