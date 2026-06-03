import { useEffect } from "react";
import PageShell from "@/components/fly4media/PageShell";
import HeroMedia from "@/components/fly4media/HeroMedia";
import ProcessList from "@/components/fly4media/ProcessList";
import Capabilities from "@/components/fly4media/Capabilities";
import CTA from "@/components/fly4media/CTA";
import { useReveal } from "@/components/fly4media/useReveal";
import about from "@/assets/about-hero.jpg";
import toby from "@/assets/toby-portrait.jpg";
import sunriseMist from "@/assets/sunrise-mist-455am.jpg";
import ctaSpringbank from "@/assets/cta-springbank-estate.jpg";

function TobyRidgeInterlude() {
  return (
    <section className="bg-[#0a0a0a] relative overflow-hidden">
      <div className="w-full h-[55vh] md:h-[70vh]">
        <img
          src={sunriseMist}
          alt="Pre-dawn alpenglow on the Canadian Rockies, mist pooling in the valley below at 4:55 AM"
          loading="lazy"
          decoding="async"
          width={1080}
          height={1920}
          className="w-full h-full object-cover object-[center_40%] opacity-95"
        />
      </div>
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      <div className="absolute bottom-10 left-0 right-0 container-x">
        <p className="t-eyebrow text-background/50">4:55 AM — Canadian Rockies</p>
      </div>
    </section>
  );
}

export default function About() {
  useEffect(() => {
    document.title = "About — Perspective Changes Everything · Fly4MEdia";
  }, []);

  return (
    <PageShell>
      {({ openContact }: { openContact: () => void }) => (
        <>
          {/* Cinematic hero */}
          <section className="relative min-h-[80dvh] md:min-h-[100dvh] w-full overflow-hidden bg-[#0a0a0a]">
            <HeroMedia
              image={about}
              alt="Drone pilot silhouette on alpine ridge at dawn"
              priority
              width={1620}
              height={1080}
            />
            {/* Bottom-only gradient — cinematic, not flat */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(8,8,8,0.88) 0%, rgba(8,8,8,0.30) 30%, transparent 60%)",
              }}
              aria-hidden
            />
            <div className="relative container-x pt-32 md:pt-40 pb-14 md:pb-20 min-h-[80dvh] md:min-h-[100dvh] flex flex-col justify-end">
              <h1 className="t-display-1 wrap-editorial text-background max-w-4xl animate-fade-up">
                We believe perspective
                <br />
                changes everything.
              </h1>
            </div>
          </section>

          <Philosophy />
          <TobyRidgeInterlude />
          <ProcessList />
          <Capabilities />

          <CTA
            onContact={openContact}
            eyebrow="If you've read this far —"
            heading={
              <>
                Let&rsquo;s talk about what
                <br />
                you&rsquo;re trying to be seen as.
              </>
            }
            backgroundImage={ctaSpringbank}
            backgroundAlt="Aerial view of a modern luxury estate on a Springbank acreage at last light, Canadian Rockies on the horizon"
          />
        </>
      )}
    </PageShell>
  );
}

function Philosophy() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="bg-background py-section">
      <div ref={ref} className="reveal container-x grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        <div className="lg:col-span-3">
          <p className="t-eyebrow text-muted-foreground mb-6">A letter</p>
          <figure>
            <div className="media-frame aspect-[3/4]">
              <img
                src={toby}
                alt="Toby Rennick, founder of Fly4MEdia, on a ridge above an alpine lake in the Canadian Rockies"
                width={1080}
                height={1440}
                loading="lazy"
                decoding="async"
                className="media-img"
              />
            </div>
            <figcaption className="mt-4">
              <span className="t-meta block">Toby Rennick</span>
              <span className="t-eyebrow text-muted-foreground">
                Founder &amp; Director, Fly4MEdia
              </span>
            </figcaption>
          </figure>
        </div>
        <div className="lg:col-span-9 max-w-3xl space-y-8">
          <p className="t-headline-2 max-w-[24ch] lg:max-w-none">
            You didn&rsquo;t spend a decade building this thing
            just to watch it get flattened by another
            forgettable drone reel. The way you&rsquo;re seen
            <em> is</em> the position you hold.
          </p>
          <p className="t-lede text-muted-foreground">
            I didn&rsquo;t start Fly4MEdia to be a drone guy.
            I started it because I kept watching beautiful
            places and serious brands get handed footage that
            made them look like everyone else &mdash; and I
            knew the frame could do more. So I picked up the
            camera, learned to fly, and stopped accepting
            &ldquo;fine.&rdquo;
          </p>
          <p className="t-lede text-muted-foreground">
            I learned to wait in the mountains. For light.
            For weather. For the line that actually means
            something. That patience is the discipline I
            built the studio around &mdash; which is why,
            everywhere else on this site, you&rsquo;ll hear
            <em> we</em>. The standard is bigger than one
            person. But the answer to your first email is
            still mine.
          </p>
        </div>
      </div>
    </section>
  );
}
