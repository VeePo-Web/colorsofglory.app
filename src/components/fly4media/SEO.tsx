import { useEffect } from "react";
import { DEFAULT_OG_IMAGE, buildCanonicalUrl } from "@/lib/seo";

type SEOProps = {
  title: string;
  description: string;
  path: string;
  image?: string;
  schema?: Array<Record<string, unknown>>;
};

function setMeta(selector: string, attribute: "content" | "href", value: string) {
  const element = document.head.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
}

function setOrCreateMeta(
  key: "name" | "property",
  name: string,
  content: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${key}="${name}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(key, name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

export default function SEO({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  schema = [],
}: SEOProps) {
  useEffect(() => {
    const canonical = buildCanonicalUrl(path);

    document.title = title;
    setOrCreateMeta("name", "description", description);
    setMeta('link[rel="canonical"]', "href", canonical);

    setOrCreateMeta("property", "og:title", title);
    setOrCreateMeta("property", "og:description", description);
    setOrCreateMeta("property", "og:url", canonical);
    setOrCreateMeta("property", "og:image", image);
    setOrCreateMeta("name", "twitter:title", title);
    setOrCreateMeta("name", "twitter:description", description);
    setOrCreateMeta("name", "twitter:image", image);

    document
      .querySelectorAll('script[data-fly4media-schema="true"]')
      .forEach((node) => node.remove());

    schema.forEach((item) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.fly4mediaSchema = "true";
      script.text = JSON.stringify(item);
      document.head.appendChild(script);
    });

    return () => {
      document
        .querySelectorAll('script[data-fly4media-schema="true"]')
        .forEach((node) => node.remove());
    };
  }, [description, image, path, schema, title]);

  return null;
}
