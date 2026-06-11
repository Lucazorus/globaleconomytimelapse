// pages/_document.tsx

import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <link rel="icon" type="image/png" href="/logostatic.png" />
        <meta name="theme-color" content="#1a2327" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
