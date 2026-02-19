import type { AppProps } from "next/app";
import Layout from "../components/Layout";
import { LangProvider } from "../lib/LangContext";
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <LangProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </LangProvider>
  );
}
