import { useReveal } from "./useReveal";
import CinematicMedia from "./CinematicMedia";
import type { Project, GalleryItem } from "@/data/projects";

export default function CaseStudyGallery({ project }: { project: Project }) {
  const used = new Set([project.heroImage, project.perspectiveImage].filter(Boolean) as string[]);
  const items = project.gallery.filter((g) => !used.has(g.src));
  if (items.length === 0) return null;

  return (
    <section className="bg-background pb-24 md:pb-40">
      <div className="container-x grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-y-28">
        {items.map((item, i) => (
          <GalleryTile key={i} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}

function GalleryTile({ item, index }: { item: GalleryItem; index: number }) {
  const ref = useReveal<HTMLDivElement>();

  const layout =
    item.ratio === "wide"
      ? "md:col-span-12"
      : index % 2 === 0
        ? "md:col-span-7 md:col-start-1"
        : "md:col-span-6 md:col-start-7";

  /*
    Wide items: aspect-[21/9] — cinema scope for drone footage.
    Was aspect-[16/9] (broadcast/YouTube ratio) — wrong register
    for aerial cinematography. 21/9 is the filmic association
    this studio's work earns.
    Portrait/square: unchanged.
  */
  const aspect =
    item.ratio === "wide"
      ? "aspect-[21/9]"
      : item.ratio === "portrait"
        ? "aspect-[4/5]"
        : "aspect-square";

  const imgW = item.ratio === "wide" ? 1920 : 1080;
  const imgH = item.ratio === "wide" ? 823  : item.ratio === "portrait" ? 1350 : 1080;

  return (
    <div ref={ref} className={`reveal group ${layout}`}>
      <div className={`media-frame ${aspect}`}>
        <CinematicMedia
          image={item.src}
          alt={item.alt}
          sources={item.videoSources}
          objectPosition={item.objectPosition}
          width={imgW}
          height={imgH}
        />
      </div>
    </div>
  );
}
