import { Link } from "react-router-dom";
import logo from "@/assets/fly4media-mark.png";

interface Props {
  onContact: () => void;
}

const SOCIAL = [
  { label: "Instagram", href: "https://instagram.com/fly4media" },
  { label: "Vimeo", href: "https://vimeo.com/fly4media" },
  { label: "YouTube", href: "https://youtube.com/@fly4media" },
];

export default function Footer({ onContact }: Props) {
  return (
    /*
      Dark close — bg-foreground books-end with the homepage Services section,
      creating a deliberate dark/light/dark cadence across the page.
      The dark ground signals: the experience has ended. This is the close.
    */
    <footer className="bg-foreground text-background">

      {/* Main body */}
      <div className="container-x pt-16 md:pt-24 pb-14 md:pb-20 grid grid-cols-1 md:grid-cols-12 gap-14 md:gap-10">

        {/* Left — brand identity block (5 cols) */}
        <div className="md:col-span-5 flex flex-col">
          {/* Mark + studio name together — the confident close wordmark */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-3 group mb-6"
            aria-label="Fly4MEdia — back to top"
            data-cursor="hover"
          >
            <img
              src={logo}
              alt=""
              width={32}
              height={32}
              className="size-7 md:size-8 object-contain brightness-0 invert opacity-90 transition-opacity duration-300 group-hover:opacity-100"
            />
          </Link>

          {/* Large wordmark — significantly larger than nav; the closing statement */}
          <p className="t-display-2 text-background leading-[1.0] tracking-[-0.03em] mb-4">
            Fly4MEdia
          </p>

          <p className="t-lede text-background/50 max-w-[26ch] leading-relaxed">
            A cinematic perspective studio.<br />
            Alberta-rooted. Available worldwide.
          </p>

          {/* Primary CTA — btn-light for dark ground */}
          <button
            onClick={onContact}
            data-cursor="hover"
            data-magnetic
            className="btn-light mt-10 self-start"
          >
            <span>Start a project</span>
            <span className="link-arrow">↗</span>
          </button>
        </div>

        {/* Right — nav + contact, two sub-columns (7 cols) */}
        <div className="md:col-span-7 md:pl-10 grid grid-cols-1 sm:grid-cols-2 gap-10">

          {/* Studio nav */}
          <div>
            <p className="t-eyebrow text-background/35 mb-5">Studio</p>
            <ul className="space-y-3">
              {[
                { label: "Work", to: "/work" },
                { label: "Services", to: "/services" },
                { label: "Areas We Serve", to: "/areas-we-serve" },
                { label: "Pricing", to: "/pricing" },
                { label: "About", to: "/about" },
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    data-cursor="hover"
                    className="t-body text-background/60 hover:text-background transition-[color,transform] duration-300 link-underline inline-block hover:translate-x-0.5"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="t-eyebrow text-background/35 mb-5">Contact</p>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:tobyrennick@gmail.com"
                  data-cursor="hover"
                  className="t-body text-background/60 hover:text-background transition-[color,transform] duration-300 link-underline inline-block hover:translate-x-0.5 break-all"
                >
                  tobyrennick@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+14038189686"
                  data-cursor="hover"
                  className="t-body text-background/60 hover:text-background transition-[color,transform] duration-300 link-underline inline-block hover:translate-x-0.5"
                >
                  403&nbsp;818&nbsp;9686
                </a>
              </li>
              <li className="t-body text-background/35">
                Calgary · Alberta · Canada
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar — copyright + social */}
      <div className="container-x pb-8 pt-6 border-t border-background/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <span className="t-micro text-background/25">
          © {new Date().getFullYear()} Fly4MEdia
        </span>

        {/* Social — text-based, editorial; no icon ambiguity */}
        <nav aria-label="Social" className="flex items-center gap-6">
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="hover"
              className="t-micro text-background/40 hover:text-background/90 transition-[color,transform] duration-300 inline-block hover:translate-x-0.5"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
