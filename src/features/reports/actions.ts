"use server";
import { socialAction } from "@/features/social/action-result";
import { createReport, resolveReport } from "./service";
export async function createReportAction(input: unknown) { return socialAction(() => createReport(input)); }
export async function resolveReportAction(input: unknown) { return socialAction(() => resolveReport(input)); }
