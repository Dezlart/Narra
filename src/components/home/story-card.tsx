import { Clock3 } from "lucide-react";
import { EditorialArt } from "./editorial-art";
import type { DemoStory } from "./demo-content";

export function StoryCard({ story }: { story: DemoStory }) {
  return (
    <article className="flex h-full flex-col">
      <EditorialArt variant={story.artwork} className="mb-5 aspect-[1.5] w-full rounded-md" />
      <p className="eyebrow mb-3 text-primary">{story.category}</p>
      <h3 className="font-editorial text-[1.45rem] leading-snug tracking-[-0.025em]">{story.title}</h3>
      <p className="mt-3 mb-6 text-sm leading-6 text-muted-foreground">{story.excerpt}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs">
        <span className="flex items-center gap-2"><span className="author-avatar size-7 bg-muted text-[10px]">{story.initials}</span>{story.author}</span>
        <span className="flex items-center gap-1 text-muted-foreground"><Clock3 className="size-3" aria-hidden="true" />{story.readingMinutes} мин</span>
      </div>
    </article>
  );
}
