import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getPublicProfile } from "@/features/users/service";
import { Avatar } from "@/features/users/avatar";
import { usernameSchema } from "@/features/auth/schemas";

export const metadata: Metadata = { title: "Профиль автора" };

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const parsed = usernameSchema.safeParse((await params).username);
  if (!parsed.success) notFound();
  const profile = await getPublicProfile(parsed.data);
  if (!profile) notFound();
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-20">
    <div className="mx-auto max-w-reading">
      <p className="eyebrow mb-6 text-primary">Сообщество Narra</p>
      <Avatar name={profile.name} large />
      <h1 className="mt-6 break-words font-editorial text-4xl leading-tight tracking-tight sm:text-5xl">{profile.name}</h1>
      <p className="mt-3 break-all text-primary">@{profile.username}</p>
      {profile.bio && <p className="mt-6 whitespace-pre-wrap break-words leading-8">{profile.bio}</p>}
      <p className="mt-5 text-sm text-muted-foreground">В Narra с {new Intl.DateTimeFormat("ru", { month: "long", year: "numeric", timeZone: "UTC" }).format(profile.createdAt)}</p>
      <section aria-labelledby="publications-title" className="mt-12 border-t border-border pt-8">
        <h2 id="publications-title" className="section-title font-editorial">Публикации</h2>
        <div className="mt-6 rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <BookOpen className="mx-auto mb-4 size-7 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Истории ещё впереди</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Здесь появятся опубликованные статьи автора.</p>
        </div>
      </section>
    </div>
  </main>;
}
