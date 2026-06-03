import { Link, useParams } from "react-router-dom";
import PageShell from "@/components/fly4media/PageShell";
import CTA from "@/components/fly4media/CTA";
import SEO from "@/components/fly4media/SEO";
import { getAreaBySlug, getNearbyAreas, hubFaqs } from "@/data/seoAreas";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildLocalBusinessSchema,
  buildServiceSchema,
} from "@/lib/seo";
import NotFound from "./NotFound";

export default function AreaPage() {
  const { slug = "" } = useParams();
  const area = getAreaBySlug(slug);

  if (!area) return <NotFound />;

  const nearbyAreas = getNearbyAreas(area.slug);
  const path = `/areas-we-serve/${area.slug}`;
  const faqItems = [
    {
      question: `Do you offer drone photography in ${area.name}?`,
      answer: `Yes. Fly4MEdia offers drone photography and aerial video in ${area.name} for real estate, venues, businesses, and location-specific content projects.`,
    },
    {
      question: `What drone services are available in ${area.name}?`,
      answer:
        "Services include aerial cinematography, real estate drone video, aerial photography, FPV drone filming, and commercial drone content.",
    },
    ...hubFaqs.slice(1, 2),
  ];

  const schema = [
    buildLocalBusinessSchema(),
    buildServiceSchema({
      name: `${area.name} drone photography and aerial video`,
      description: area.description,
      path,
      areas: [area.name, area.region],
    }),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Areas We Serve", path: "/areas-we-serve" },
      { name: area.name, path },
    ]),
    buildFaqSchema(faqItems),
  ];

  return (
    <PageShell>
      {({ openContact }: { openContact: () => void }) => (
        <>
          <SEO
            title={area.title}
            description={area.description}
            path={path}
            schema={schema}
          />

          <section className="pt-36 md:pt-48 lg:pt-56 pb-section-sm container-x">
            <p className="t-eyebrow text-muted-foreground mb-8 animate-fade-up">
              {area.region} aerial media
            </p>
            <h1 className="t-display-2 wrap-editorial wrap-editorial-mobile-off max-w-5xl animate-fade-up">
              {area.h1}
            </h1>
            <p className="t-lede mt-10 lg:mt-12 max-w-2xl text-muted-foreground">
              {area.intro}
            </p>
          </section>

          <section className="container-x pb-section border-b border-border">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-4">
                <h2 className="t-headline-1 max-w-[13ch]">
                  Why aerial media works here.
                </h2>
              </div>
              <div className="lg:col-span-8 border-t border-border">
                {area.localAngles.map((angle) => (
                  <p
                    key={angle}
                    className="t-body text-muted-foreground leading-relaxed border-b border-border py-6"
                  >
                    {angle}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="py-section bg-foreground text-background">
            <div className="container-x">
              <h2 className="t-display-2 wrap-editorial max-w-[16ch] mb-14 md:mb-20">
                Drone services in {area.name}.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
                <ServiceBlock
                  title={`Real estate drone photography in ${area.name}`}
                  body={area.services.realEstate}
                />
                {area.services.venues && (
                  <ServiceBlock
                    title={`Venue and destination aerial video in ${area.name}`}
                    body={area.services.venues}
                  />
                )}
                {area.services.agriculture && (
                  <ServiceBlock
                    title={`Farm, ranch, and acreage drone footage in ${area.name}`}
                    body={area.services.agriculture}
                  />
                )}
                <ServiceBlock
                  title={`Business and content drone video in ${area.name}`}
                  body={area.services.business}
                />
              </div>
            </div>
          </section>

          <section className="py-section container-x border-b border-border">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-4">
                <h2 className="t-headline-1">Target searches</h2>
              </div>
              <div className="lg:col-span-8">
                <p className="t-eyebrow text-muted-foreground mb-5">
                  Primary keyword
                </p>
                <p className="t-headline-2 mb-10">{area.primaryKeyword}</p>
                <div className="flex flex-wrap gap-3">
                  {area.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="t-micro border border-border px-3 py-2 text-muted-foreground"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="py-section container-x">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-4">
                <h2 className="t-headline-1">Nearby areas</h2>
              </div>
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {nearbyAreas.map((nearby) => (
                  <Link
                    key={nearby.slug}
                    to={`/areas-we-serve/${nearby.slug}`}
                    data-cursor="hover"
                    className="group border-t border-border pt-5"
                  >
                    <p className="t-headline-2 link-underline">
                      {nearby.name}
                    </p>
                    <p className="t-body text-muted-foreground mt-3 leading-relaxed">
                      {nearby.primaryKeyword}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="py-section-sm container-x border-t border-border">
            <Link
              to="/areas-we-serve"
              data-cursor="hover"
              className="t-button link-underline text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Back to all service areas
            </Link>
          </section>

          <CTA
            onContact={openContact}
            eyebrow={area.name}
            heading={
              <>
                {area.cta}
                <br />
                with intent.
              </>
            }
            cta="Begin a conversation"
          />
        </>
      )}
    </PageShell>
  );
}

function ServiceBlock({ title, body }: { title: string; body: string }) {
  return (
    <article className="border-t border-background/20 pt-6">
      <h3 className="t-headline-2 text-background mb-4">{title}</h3>
      <p className="t-body text-background/60 leading-relaxed">{body}</p>
    </article>
  );
}
