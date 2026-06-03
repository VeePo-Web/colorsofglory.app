import { useState } from "react";
import Header from "@/components/fly4media/Header";
import Hero from "@/components/fly4media/Hero";
import FeaturedWork from "@/components/fly4media/FeaturedWork";
import BrandStatement from "@/components/fly4media/BrandStatement";
import Services from "@/components/fly4media/Services";
import Divider from "@/components/fly4media/Divider";
import CaseStudyTeaser from "@/components/fly4media/CaseStudyTeaser";
import CTA from "@/components/fly4media/CTA";
import Footer from "@/components/fly4media/Footer";
import ContactModal from "@/components/fly4media/ContactModal";
import Intro from "@/components/fly4media/Intro";
import ctaSpringbank from "@/assets/cta-springbank-estate.jpg";

const Index = () => {
  const [open, setOpen] = useState(false);
  const openContact = () => setOpen(true);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onContact={openContact} />
      <main>
        <Hero onContact={openContact} />
        <FeaturedWork />
        <BrandStatement />
        <Services />
        <Divider />
        <CaseStudyTeaser />
        <CTA
          onContact={openContact}
          backgroundImage={ctaSpringbank}
          backgroundAlt="Aerial view of a modern luxury estate on a Springbank acreage at last light, Canadian Rockies on the horizon"
        />
      </main>
      <Footer onContact={openContact} />

      <ContactModal open={open} onClose={() => setOpen(false)} />
      <Intro />
    </div>
  );
};

export default Index;
