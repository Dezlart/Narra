import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/auth/guards";
import { idSchema } from "@/features/articles/schemas";
import { pageResult, type QueryParams } from "@/features/admin/queries";
import { publicPage } from "@/features/public-content/params";
const reportSelect = { id: true, targetType: true, reason: true, description: true, status: true, createdAt: true,
  resolvedAt: true, resolutionNote: true, reporter: { select: { name: true, username: true } }, resolvedBy: { select: { name: true } },
  article: { select: { id: true, slug: true, status: true, publishedRevision: { select: { id: true, title: true, excerpt: true } } } },
  comment: { select: { id: true, content: true, hiddenAt: true, deletedAt: true, author: { select: { name: true } },
    article: { select: { id: true, slug: true, status: true } } } } } satisfies Prisma.ReportSelect;
export async function listReports(params: QueryParams = {}, headers?: Headers) {
  await requireModerator(headers);
  const page = publicPage(params.page), status = z.enum(["OPEN", "RESOLVED", "DISMISSED"]).safeParse(params.status ?? "OPEN");
  const targetType = z.enum(["ARTICLE", "COMMENT"]).safeParse(params.targetType);
  return pageResult(await getPrisma().report.findMany({ where: { ...(status.success ? { status: status.data } : {}), ...(targetType.success ? { targetType: targetType.data } : {}) },
    select: reportSelect, orderBy: [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }], take: 21, skip: (page - 1) * 20 }), page);
}
export async function getReport(input: unknown, headers?: Headers) {
  await requireModerator(headers);
  return getPrisma().report.findUnique({ where: { id: idSchema.parse(input) }, select: reportSelect });
}
