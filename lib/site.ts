// URL canonique du site, utilisée pour les balises Open Graph / canonical.
// Sur Vercel, définir NEXT_PUBLIC_SITE_URL dans les variables d'environnement
// du projet si le domaine diffère (ex: domaine custom).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://globaleconomytimelapse.vercel.app";
