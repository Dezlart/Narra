import "server-only";
import { revalidatePath } from "next/cache";
import { socialErrorMessage } from "./errors";
export async function socialAction<T>(work: () => Promise<T>) {
  try {
    const value = await work();
    // Personalized state is request-only. Refresh the current server tree and
    // invalidate visited catalogues/bookmarks/profiles for this browser.
    revalidatePath("/", "layout");
    return { ok: true as const, value };
  } catch (error) { return { ok: false as const, message: socialErrorMessage(error) }; }
}
