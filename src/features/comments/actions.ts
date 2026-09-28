"use server";
import { socialAction } from "@/features/social/action-result";
import { socialErrorMessage } from "@/features/social/errors";
import { createComment, deleteOwnComment, hideComment, restoreComment } from "./service";
import { getCommentReplies } from "./queries";
export async function createCommentAction(input: unknown) { return socialAction(() => createComment(input)); }
export async function deleteCommentAction(input: unknown) { return socialAction(() => deleteOwnComment(input)); }
export async function hideCommentAction(input: unknown) { return socialAction(() => hideComment(input)); }
export async function restoreCommentAction(input: unknown) { return socialAction(() => restoreComment(input)); }
export async function loadRepliesAction(input: unknown) {
  try { return { ok: true as const, value: await getCommentReplies(input) }; }
  catch (error) { return { ok: false as const, message: socialErrorMessage(error) }; }
}
