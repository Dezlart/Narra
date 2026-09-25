import { z } from "zod";
import { nameSchema, usernameSchema } from "@/features/auth/schemas";

export const profileSchema = z.strictObject({
  name: nameSchema,
  username: usernameSchema,
  bio: z.string().trim().max(500, "Не больше 500 символов."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileState = { success: boolean; message: string };
