import { Link } from "react-router-dom";
import PageShell from "@/components/fly4media/PageShell";
import CTA from "@/components/fly4media/CTA";
import SEO from "@/components/fly4media/SEO";
import { areaGroups, areaPages, hubFaqs } from "@/data/seoAreas";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildLocalBusinessSchema,
  buildServiceSchema,
} from "@/lib/seo";

const areasServedSchema = [
  buildLocalBusinessSchema(),
  buildServiceSchema({
    name: "Drone photography and aerial video across Alberta",
    description:
      "Premium drone photography, aerial cinematography, real estate drone video, FPV drone filming, and commercial aerial media across Calgary, Cochrane, Canmore, Springbank, Bearspaw, Elbow Valley, Ghost Lake, and Bragg Creek.",
    path: "/areas-we-serve",
    areas: areaPages.map((area) => area.name),
  }),
  buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Areas We Serve", path: "/areas-we-serve" },
  ]),
  buildFaqSchema(hubFaqs),
];

export default function AreasWeServe() {
  return (
    <PageShell>
      {({ openContact }: { openContact: () => void }) => (
        <>
          <SEO
            title="Drone Photography Alberta | Areas We Serve | Fly4MEdia"
            description="Premium drone photography and aerial video for real estate, venues, farms, tourism, and businesses across Calgary, Cochrane, Canmore, Springbank, and beyond."
            path="/areas-we-serve"
            schema={areasServedSchema}
          />

          <section className="pt-36 md:pt-48 lg:pt-56 pb-section-sm container-x">
            <p className="t-eyebrow text-muted-foreground mb-8 animate-fade-up">
              Areas we serve
            </p>
            <h1 className="t-display-2 wrap-editorial wrap-editorial-mobile-off max-w-5xl animate-fade-up">
              Drone photography across Alberta&apos;s most cinematic communities.
            </h1>
            <p className="t-lede mt-10 lg:mt-12 max-w-2xl text-muted-foreground">
              Real estate listings, wedding venues, farms, tourism brands, and
              commercial campaigns all need the same thing: footage that makes
              place visible before someone ever arrives.
            </p>
          </section>

          <section className="container-x pb-section border-b border-border">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-4">
                <h2 className="t-headline-1 max-w-[12ch]">
                  Local intent, built for the right searches.
                </h2>
              </div>
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {areaGroups.map((group) => (
                  <article key={group.title} className="border-t border-border pt-6">
                    <h3 className="t-headline-2 mb-4">{group.title}</h3>
                    <p className="t-body text-muted-foreground leading-relaxed mb-6">
                      {group.description}
                    </p>
                    <ul className="space-y-3">
                      {group.areas.map((slug) => {
                        const area = areaPages.find((item) => item.slug === slug);
                        if (!area) return null;

                        return (
                          <li key={slug}>
                            <Link
                              to={`/areas-we-serve/${area.slug}`}
                              data-cursor="hover"
                              className="t-body link-underline text-foreground/70 hover:text-foreground transition-colors duration-300"
                            >
                              {area.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="py-section bg-foreground text-background">
            <div className="container-x">
              <h2 className="t-display-2 wrap-editorial max-w-[16ch] mb-14 md:mb-20">
                The searches we are building around.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                {[
                  "Real estate drone photography",
                  "Wedding venue aerial video",
                  "Farm and acreage drone footage",
                  "Commercial drone cinematography",
                ].map((service) => (
                  <div key={service} className="border-t border-background/20 pt-6">
                    <h3 className="t-headline-2 text-background mb-4">
                      {service}
                    </h3>
                    <p className="t-body text-background/60 leading-relaxed">
                      Built for location-specific searches across Calgary,
                      Cochrane, Canmore, Springbank, Bearspaw, Elbow Valley,
                      Ghost Lake, Bragg Creek, and the surrounding communities.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-section container-x">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-4">
                <h2 className="t-headline-1">Common questions</h2>
              </div>
              <div className="lg:col-span-8 border-t border-border">
                {hubFaqs.map((faq) => (
                  <div key={faq.question} className="border-b border-border py-7">
                    <h3 className="t-headline-2 mb-3">{faq.question}</h3>
                    <p className="t-body text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <CTA
            onContact={openContact}
            eyebrow="Local aerial media"
            heading={
              <>
                Put your place
                <br />
                in the right search.
              </>
            }
            cta="Start a local project"
          />
        </>
      )}
    </PageShell>
  );
}
