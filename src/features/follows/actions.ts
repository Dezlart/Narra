"use server";
import { socialAction } from "@/features/social/action-result";
import { followUser, unfollowUser } from "./service";
export async function followUserAction(input: unknown) { return socialAction(() => followUser(input)); }
export async function unfollowUserAction(input: unknown) { return socialAction(() => unfollowUser(input)); }
