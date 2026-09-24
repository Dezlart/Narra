"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoTopics, type DemoStory, type DemoTopic } from "./demo-content";
import { StoryCard } from "./story-card";

export function StoryPreview({ stories }: { stories: readonly DemoStory[] }) {
  const [topic, setTopic] = useState<DemoTopic>("Все темы");
  const visibleStories = topic === "Все темы" ? stories : stories.filter((story) => story.category === topic);

  return (
    <section id="latest" aria-labelledby="latest-title" className="scroll-mt-6 pt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="latest-title" className="section-title">Свежие истории<span className="text-primary">.</span></h2>
        <span className="text-xs text-muted-foreground">Новые мысли для вашей паузы</span>
      </div>
      <div aria-label="Темы демоматериалов" role="group" className="my-6 flex flex-wrap gap-2">
        {demoTopics.map((item) => (
          <Button key={item} variant={topic === item ? "default" : "outline"} size="sm" aria-pressed={topic === item} aria-controls="story-list" onClick={() => setTopic(item)} className={topic === item ? "bg-foreground text-background hover:bg-foreground/90" : "bg-transparent"}>{item}</Button>
        ))}
      </div>
      <p className="sr-only" role="status">{visibleStories.length ? `Материалов: ${visibleStories.length}` : "В этой теме пока нет демоматериалов"}</p>
      <div id="story-list" className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {visibleStories.map((story) => <StoryCard key={story.id} story={story} />)}
        {visibleStories.length === 0 && (
          <div className="col-span-full flex min-h-70 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
            <BookOpen className="mb-4 size-7 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-editorial text-xl">Здесь появятся новые истории</h3>
            <p className="mt-2 mb-5 text-sm text-muted-foreground">В этой теме пока нет демонстрационных материалов.</p>
            <Button variant="outline" onClick={() => setTopic("Все темы")}>Посмотреть все темы</Button>
          </div>
        )}
      </div>
    </section>
  );
}
