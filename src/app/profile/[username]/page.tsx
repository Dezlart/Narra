import { cache, Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/features/users/service";
import { Avatar } from "@/features/users/avatar";
import { usernameSchema } from "@/features/auth/schemas";
import { getPublishedArticlesByAuthor } from "@/features/public-content/queries";
import { ArticleFeed, FeedSkeleton } from "@/features/public-content/feed";
import { publicMetadata } from "@/features/public-content/metadata";
import type { SearchParams } from "@/features/public-content/params";
import { ProfileFollow } from "@/features/follows/profile-follow";

type Props = { params: Promise<{ username: string }>; searchParams: SearchParams };
const profileForPage = cache(async (username: string) => {
  await connection();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) notFound();
  const profile = await getPublicProfile(parsed.data);
  if (!profile) notFound();
  return profile;
});
export async function generateMetadata({ params }: Props) {
  const profile = await profileForPage((await params).username);
  return publicMetadata(profile.name, profile.bio || `Читайте опубликованные истории автора ${profile.name} в Narra.`, `/profile/${profile.username}`);
}
async function Publications({ username, searchParams }: { username: string; searchParams: SearchParams }) {
  return <ArticleFeed feed={await getPublishedArticlesByAuthor(username, (await searchParams).page)} path={`/profile/${username}`} empty="Истории ещё впереди" />;
}
export default async function ProfilePage({ params, searchParams }: Props) {
  const profile = await profileForPage((await params).username);
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-20">
    <div className="max-w-reading">
      <p className="eyebrow mb-6 text-primary">Сообщество Narra</p>
      <Avatar name={profile.name} large />
      <h1 className="mt-6 wrap-anywhere font-editorial text-4xl leading-tight tracking-tight sm:text-5xl">{profile.name}</h1>
      <p className="mt-3 break-all text-primary">@{profile.username}</p>
      {profile.bio && <p className="mt-6 whitespace-pre-wrap wrap-anywhere leading-8">{profile.bio}</p>}
      <p className="mt-5 text-sm text-muted-foreground">В Narra с {new Intl.DateTimeFormat("ru", { month: "long", year: "numeric", timeZone: "UTC" }).format(profile.createdAt)}</p>
      <Suspense fallback={<p role="status" className="mt-6 text-sm">Загружаем подписки…</p>}><ProfileFollow username={profile.username!} /></Suspense>
    </div>
    <section aria-labelledby="publications-title" className="mt-12 border-t border-border pt-8">
      <h2 id="publications-title" className="section-title mb-8 font-editorial">Публикации</h2>
      <Suspense fallback={<FeedSkeleton />}><Publications username={profile.username!} searchParams={searchParams} /></Suspense>
    </section>
  </main>;
}
