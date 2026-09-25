import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";

const handlers = toNextJsHandler((request: Request) => getAuth().handler(request));
export const GET = handlers.GET;
export const POST = handlers.POST;
