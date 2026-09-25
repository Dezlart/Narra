import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Settings } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/features/users/avatar";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";

export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-20">
    <PrivatePageLifecycle />
    <div className="mx-auto max-w-reading">
      <p className="eyebrow mb-4 text-primary">Личный кабинет</p>
      <h1 className="break-words font-editorial text-4xl leading-tight tracking-tight sm:text-5xl">Здравствуйте, {user.name}.</h1>
      <p className="mt-4 text-muted-foreground">Здесь начинается ваша история в Narra.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link href="/dashboard/articles">Мои статьи <ArrowUpRight aria-hidden="true" /></Link></Button><Button variant="outline" asChild><Link href="/editor/new">Написать статью</Link></Button></div>
      <section aria-label="Ваш профиль" className="my-10 rounded-lg border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-5">
          <Avatar name={user.name} large />
          <div className="min-w-0">
            <h2 className="break-words text-xl font-medium">{user.name}</h2>
            {user.username && <p className="mt-1 break-all text-sm text-primary">@{user.username}</p>}
            <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{user.bio || "Расскажите немного о себе в настройках, чтобы читатели могли познакомиться с вами."}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {user.username && <Button asChild><Link href={`/profile/${user.username}`}>Публичный профиль <ArrowUpRight aria-hidden="true" /></Link></Button>}
          <Button variant="outline" asChild><Link href="/dashboard/settings"><Settings aria-hidden="true" /> Настройки</Link></Button>
        </div>
      </section>
      <SignOutButton />
    </div>
  </main>;
}
