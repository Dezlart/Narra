"use server";
import { socialAction } from "@/features/social/action-result";
import { saveArticle, unsaveArticle } from "./service";
export async function saveArticleAction(input: unknown) { return socialAction(() => saveArticle(input)); }
export async function unsaveArticleAction(input: unknown) { return socialAction(() => unsaveArticle(input)); }
