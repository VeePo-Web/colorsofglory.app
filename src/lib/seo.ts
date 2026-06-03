export const SITE_URL = "https://fly4me.ca";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image-v2.png`;

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath === "/" ? "" : cleanPath}`;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(item.path),
    })),
  };
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Fly4MEdia",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    sameAs: [
      "https://instagram.com/fly4media",
      "https://vimeo.com/fly4media",
      "https://youtube.com/@fly4media",
    ],
  };
}

export function buildLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#localbusiness`,
    name: "Fly4MEdia",
    url: SITE_URL,
    image: DEFAULT_OG_IMAGE,
    telephone: "+14038189686",
    email: "tobyrennick@gmail.com",
    areaServed: [
      "Calgary",
      "Cochrane",
      "Canmore",
      "Springbank",
      "Bearspaw",
      "Elbow Valley",
      "Ghost Lake",
      "Bragg Creek",
      "Alberta",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Calgary",
      addressRegion: "AB",
      addressCountry: "CA",
    },
    priceRange: "$$",
    description:
      "Premium drone cinematography, aerial photography, FPV drone filming, and real estate media across Calgary, Cochrane, Canmore, Springbank, Bearspaw, and surrounding Alberta communities.",
  };
}

export function buildServiceSchema({
  name,
  description,
  path,
  areas,
}: {
  name: string;
  description: string;
  path: string;
  areas: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    provider: {
      "@id": `${SITE_URL}/#localbusiness`,
      name: "Fly4MEdia",
    },
    areaServed: areas,
    url: buildCanonicalUrl(path),
    serviceType: [
      "Drone photography",
      "Aerial cinematography",
      "Real estate drone video",
      "FPV drone filming",
    ],
  };
}

export function buildFaqSchema(
  questions: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
