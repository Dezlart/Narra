"use server";
import { socialAction } from "@/features/social/action-result";
import { changeUser, createCategory, updateCategory, setCategoryArchived, setArticleArchived } from "./service";
export async function changeUserAction(input: unknown) { return socialAction(() => changeUser(input)); }
export async function createCategoryAction(input: unknown) { return socialAction(() => createCategory(input)); }
export async function updateCategoryAction(input: unknown) { return socialAction(() => updateCategory(input)); }
export async function categoryStateAction(input: unknown) { return socialAction(() => setCategoryArchived(input)); }
export async function articleStateAction(input: unknown) { return socialAction(() => setArticleArchived(input)); }
