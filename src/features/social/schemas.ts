import { z } from "zod";
import { idSchema } from "@/features/articles/schemas";
import { usernameSchema } from "@/features/auth/schemas";
export const articleSocialSchema = z.strictObject({ articleId: idSchema });
export const followSchema = z.strictObject({ username: usernameSchema });
