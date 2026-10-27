// Storefront content that marketing can edit without touching components.

export type SocialAccount = { handle: string; url: string };

export type TikTokVideo = {
  /** Numeric TikTok video id, e.g. the last segment of tiktok.com/@shop/video/7350000000000000000 */
  id: string;
  caption: string;
  /** Optional cover image; falls back to the linked product image. */
  cover?: string;
  /** SKU of the product featured in the video. */
  productSku?: string;
};

const instagramHandle = process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE ?? "yamourabeauty";
const tiktokHandle = process.env.NEXT_PUBLIC_TIKTOK_HANDLE ?? "yamoura.ma";
const whatsappNumber = "212666540750";

/** wa.me link that opens a WhatsApp chat with the shop, message pre-filled. */
export const whatsappLink = (message = "Bonjour Yamoura, j’ai une question.") =>
  `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

export const site = {
  name: "Yamoura",
  tagline: "Beauty end Luxury",
  /** Shown after "Livraison offerte dès …", whose amount comes from the desktop app. */
  announcements: [
    "Paiement à la livraison partout au Maroc",
    "Produits 100% authentiques, marques vérifiées",
    "Une équipe à votre écoute 7j/7",
  ],
  instagram: {
    handle: instagramHandle,
    url: `https://www.instagram.com/${instagramHandle}/`,
  } satisfies SocialAccount,
  tiktok: {
    handle: tiktokHandle,
    url: `https://www.tiktok.com/@${tiktokHandle}`,
  } satisfies SocialAccount,
  whatsapp: {
    display: "+212 6 66 54 07 50",
    url: whatsappLink(),
  },
  /** Add real TikTok videos here to play them inline on the homepage. */
  tiktokVideos: [] as TikTokVideo[],
};

/** Korean brands power the K-Beauty tab and badges. */
export const koreanBrands = new Set(
  [
    "Anua",
    "Arencia",
    "Beauty of Joseon",
    "Celimax",
    "Dr. Althea",
    "Dr. Melaxin",
    "K-Secret",
    "Laneige",
    "Medicube",
    "Some By Mi",
    "TIRTIR",
    "COSRX",
    "Axis-Y",
    "Skin1004",
    "Round Lab",
    "Torriden",
    "APLB",
    "Banila Co",
    "belif",
    "Benton",
    "Biodance",
    "By Wishtrend",
    "Dr. Ceuracle",
    "Dr. Jart+",
    "HaruHaru",
    "Heimish",
    "I’m From",
    "Isntree",
    "Missha",
    "mixsoon",
    "Numbuzin",
    "Purito",
    "Pyunkang Yul",
    "Tocobo",
    "Tonymoly",
  ].map((brand) => brand.toLocaleLowerCase("fr")),
);

export const isKoreanBrand = (brand: string) =>
  koreanBrands.has(brand.trim().toLocaleLowerCase("fr"));

/** Short brand blurbs for the "Tendances" spotlight. Unknown brands get a generic line. */
export const brandStories: Record<string, string> = {
  rituals: "Des rituels de soin inspirés des traditions asiatiques.",
  medicube: "Soins coréens ciblés aux formules dermo-inspirées.",
  arencia: "Boosters coréens concentrés pour une peau éclatante.",
  "huda beauty": "Le maquillage glam iconique aux pigments intenses.",
  "beauty of joseon": "Le soin coréen inspiré des rituels hanbang.",
  gisou: "Soins capillaires infusés au miel, brillance garantie.",
  anua: "La K-beauty apaisante pour les peaux sensibles.",
  celimax: "Actifs coréens ciblés pour une peau nette.",
  "dr. althea": "Des soins réparateurs pour une peau apaisée.",
  "victoria's secret": "Brumes parfumées iconiques et envoûtantes.",
  "sol de janeiro": "Des senteurs solaires inspirées du Brésil.",
  "color wow": "Des soins capillaires anti-frisottis primés.",
  "rare beauty": "Une beauté sincère, à porter sans filtre.",
  laneige: "L’hydratation coréenne signature.",
  "charlotte tilbury": "Le glamour britannique, en coffrets précieux.",
  maange: "Pinceaux et accessoires pour un teint parfait.",
  nyx: "Le maquillage pro, accessible et audacieux.",
  kayali: "Des parfums gourmands à superposer.",
};

export type WordmarkStyle = "serif" | "serif-caps" | "bold" | "wide" | "lower" | "italic";

/**
 * Typographic wordmarks for the partners carousel. Drop an SVG/PNG in
 * /public/partners and set `logo` to use an official logo instead.
 */
export const partnerWordmarks: Record<string, { style: WordmarkStyle; logo?: string }> = {
  rituals: { style: "wide", logo: "/partners/rituals.png" },
  medicube: { style: "lower", logo: "/partners/medicube.png" },
  arencia: { style: "serif-caps", logo: "/partners/arencia.jpg" },
  "huda beauty": { style: "bold", logo: "/partners/huda-beauty.png" },
  "beauty of joseon": { style: "serif", logo: "/partners/beauty-of-joseon-wordmark.png" },
  gisou: { style: "italic", logo: "/partners/gisou.png" },
  anua: { style: "lower", logo: "/partners/anua.jpg" },
  celimax: { style: "lower", logo: "/partners/celimax.png" },
  "dr. althea": { style: "serif-caps" },
  "victoria's secret": { style: "serif-caps" },
  "sol de janeiro": { style: "italic" },
  "color wow": { style: "bold" },
  nyx: { style: "bold" },
  "rare beauty": { style: "serif" },
  "dr. melaxin": { style: "wide" },
  shiseido: { style: "wide" },
  laneige: { style: "wide" },
  "charlotte tilbury": { style: "serif-caps" },
  "paula's choice": { style: "lower" },
  benefit: { style: "italic" },
  "natasha denona": { style: "serif-caps" },
  byoma: { style: "bold" },
  "some by mi": { style: "lower" },
  thebalm: { style: "italic" },
  nudestix: { style: "bold" },
  "k-secret": { style: "wide" },
  tirtir: { style: "bold" },
  "makeup by mario": { style: "serif" },
  kayali: { style: "wide" },
  hourglass: { style: "serif-caps" },
  "it cosmetics": { style: "bold" },
  "tangle teezer": { style: "lower" },
  invisibobble: { style: "lower" },
  maange: { style: "italic" },
};
