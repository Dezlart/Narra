"use server";
import { socialAction } from "@/features/social/action-result";
import { likeArticle, unlikeArticle } from "./service";
export async function likeArticleAction(input: unknown) { return socialAction(() => likeArticle(input)); }
export async function unlikeArticleAction(input: unknown) { return socialAction(() => unlikeArticle(input)); }
