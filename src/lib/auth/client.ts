"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { NarraAuth } from "./server";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<NarraAuth>()],
});
