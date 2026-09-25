"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      window.location.replace("/login");
    } catch { setError(true); setPending(false); }
  }
  return <div>
    <Button variant="outline" onClick={signOut} disabled={pending}><LogOut aria-hidden="true" />{pending ? "Выходим…" : "Выйти"}</Button>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">Не удалось выйти. Попробуйте снова.</p>}
  </div>;
}
