import { ArrowDown, MoveUpRight } from "lucide-react";
import { FeaturedStory } from "@/components/home/featured-story";
import { StoryPreview } from "@/components/home/story-preview";
import { Spotlight } from "@/components/home/spotlight";
import { demoStories } from "@/components/home/demo-content";

export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1} className="page-container">
      <section aria-labelledby="welcome-title" className="py-10 sm:py-14">
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="eyebrow text-muted-foreground">Журнал любопытных людей</p>
          <span className="rounded-full border border-border px-3 py-1 text-[10px] font-medium tracking-wider text-muted-foreground">ДЕМО-ВЫПУСК 001</span>
        </div>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <h1 id="welcome-title" className="max-w-3xl font-editorial text-[clamp(2.3rem,4.5vw,4.1rem)] leading-[1.12] tracking-[-0.045em]">Есть идеи.<br />Есть что <span className="italic text-primary">рассказать.</span></h1>
          <p className="max-w-78 text-sm leading-7 text-muted-foreground lg:pb-1">Технологии, культура и люди.<br />Истории, которые помогают понять мир — и увидеть в нём больше.</p>
        </div>
      </section>
      <FeaturedStory />
      <div className="flex items-center gap-2 border-b border-border py-4 text-xs text-muted-foreground"><ArrowDown className="size-3.5 text-primary" aria-hidden="true" /> Немного замедлиться. Узнать что-то новое.</div>
      <StoryPreview stories={demoStories} />
      <Spotlight />
      <section id="about" aria-labelledby="about-title" className="mt-14 grid scroll-mt-6 gap-6 border-y border-border bg-muted/50 px-6 py-8 sm:px-9 md:grid-cols-[1fr_1fr] md:items-center">
        <div><p className="eyebrow mb-4 text-primary">Разные голоса. Общий интерес.</p><h2 id="about-title" className="font-editorial text-3xl leading-tight tracking-tight">Хорошие истории<br />расширяют мир<MoveUpRight className="ml-3 inline size-6 text-primary" aria-hidden="true" /></h2></div>
        <p className="max-w-lg text-sm leading-7 text-muted-foreground">Narra — пространство для тех, кому есть чем поделиться и о чём задуматься. Мы верим в личный опыт, внимательный взгляд и разговор по существу. Сейчас перед вами первый взгляд на будущий журнал.</p>
      </section>
    </main>
  );
}
