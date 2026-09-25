import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { ProfileForm } from "@/features/users/profile-form";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";

export const metadata: Metadata = { title: "Настройки профиля", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await requirePageUser("/dashboard/settings");
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-20">
    <PrivatePageLifecycle />
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} aria-hidden="true" /> Личный кабинет</Link>
      <p className="eyebrow mb-4 text-primary">Ваш голос, ваш профиль</p>
      <h1 className="font-editorial text-4xl tracking-tight">Настройки профиля</h1>
      <p className="mb-8 mt-4 text-sm leading-6 text-muted-foreground">Эти данные будут видны в вашем публичном профиле. Email останется приватным.</p>
      <ProfileForm profile={{ name: user.name, username: user.username ?? "", bio: user.bio ?? "" }} />
    </div>
  </main>;
}
