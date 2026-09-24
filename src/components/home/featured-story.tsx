import { Clock3 } from "lucide-react";
import { EditorialArt } from "./editorial-art";

export function FeaturedStory() {
  return (
    <section aria-labelledby="featured-title" className="grid overflow-hidden rounded-lg border border-border bg-card md:grid-cols-2">
      <div className="flex flex-col justify-between p-6 sm:p-9 lg:p-11">
        <div>
          <p className="eyebrow mb-6 flex items-center gap-2 text-primary"><span className="size-1.5 rounded-full bg-primary" /> История на обложке</p>
          <p className="mb-3 text-xs font-medium text-muted-foreground">ИДЕИ · ОБЩЕСТВО</p>
          <h2 id="featured-title" className="font-editorial text-[clamp(1.8rem,3.3vw,2.8rem)] leading-[1.16] tracking-[-0.035em]">Будущее создают те,<br className="hidden lg:block" /> кто задаёт вопросы</h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">О силе любопытства, непрямых путях и смелости смотреть на привычные вещи под другим углом.</p>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5"><span className="author-avatar bg-[#ece1d1]">ЕЛ</span><span>Елена Левина</span></div>
          <span className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> 7 мин чтения</span>
        </div>
      </div>
      <div className="relative min-h-65 bg-[#dce6d9] md:min-h-105">
        <EditorialArt variant="feature" className="absolute inset-0 size-full" />
        <span className="absolute right-5 top-5 text-xs tracking-widest text-[#405747]" aria-hidden="true">NARRA / 001</span>
      </div>
    </section>
  );
}
