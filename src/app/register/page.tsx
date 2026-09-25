import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";

export const metadata: Metadata = { title: "Регистрация", robots: { index: false, follow: false } };

export default function RegisterPage() { return <AuthPage mode="register" />; }
