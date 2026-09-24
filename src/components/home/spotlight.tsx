import { Asterisk } from "lucide-react";
import { demoSpotlight } from "./demo-content";

export function Spotlight() {
  return (
    <section id="spotlight" aria-labelledby="spotlight-title" className="mt-16 scroll-mt-6 border-t border-foreground pt-7">
      <div className="flex items-center gap-3"><Asterisk className="size-6 text-primary" aria-hidden="true" /><h2 id="spotlight-title" className="section-title">В фокусе</h2></div>
      <div className="mt-7 grid gap-7 md:grid-cols-3">
        {demoSpotlight.map((story, index) => (
          <article key={story.title} className="flex gap-4 border-b border-border pb-6 md:border-b-0 md:border-r md:pr-6 md:last:border-r-0">
            <span className="font-editorial text-4xl text-primary/65" aria-hidden="true">0{index + 1}</span>
            <div><p className="eyebrow mb-3 text-muted-foreground">{story.category}</p><h3 className="text-base font-semibold leading-snug">{story.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{story.note}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}
