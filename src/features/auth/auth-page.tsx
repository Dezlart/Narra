import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { safeReturnTo } from "./schemas";
import { AuthForm } from "./auth-form";
import { SignOutButton } from "./sign-out-button";

export async function AuthPage({ mode, returnTo }: { mode: "login" | "register"; returnTo?: string }) {
  const user = await getCurrentUser();
  if (user && !user.isBanned) redirect(safeReturnTo(returnTo));
  const registering = mode === "register";
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-20">
    <div className="mx-auto max-w-md">
      <p className="eyebrow mb-4 text-primary">{registering ? "Ваше место среди историй" : "С возвращением"}</p>
      <h1 className="font-editorial text-4xl leading-tight tracking-tight">{registering ? "Начните свою историю" : "Рады видеть вас снова"}</h1>
      <p className="mb-8 mt-4 text-sm leading-6 text-muted-foreground">{registering ? "Создайте профиль Narra — расскажите о себе и присоединяйтесь к сообществу." : "Войдите, чтобы открыть свой кабинет и продолжить знакомство с Narra."}</p>
      {user?.isBanned ? <div className="space-y-5 rounded-md border border-border bg-card p-6">
        <p role="alert">Доступ к аккаунту ограничен. Вы можете выйти из него.</p>
        <SignOutButton />
      </div> : <AuthForm mode={mode} returnTo={safeReturnTo(returnTo)} />}
    </div>
  </main>;
}
