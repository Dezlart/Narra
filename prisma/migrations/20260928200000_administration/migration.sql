-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('ARTICLE', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_OR_ABUSE', 'ILLEGAL_OR_DANGEROUS', 'PRIVACY', 'MISLEADING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "articleId" TEXT,
    "commentId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "activeKey" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleView" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "viewBucket" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_activeKey_key" ON "Report"("activeKey");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_id_idx" ON "Report"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_articleId_idx" ON "Report"("articleId");

-- CreateIndex
CREATE INDEX "Report_commentId_idx" ON "Report"("commentId");

-- CreateIndex
CREATE INDEX "Report_resolvedById_idx" ON "Report"("resolvedById");

-- CreateIndex
CREATE INDEX "ArticleView_articleId_createdAt_idx" ON "ArticleView"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleView_createdAt_idx" ON "ArticleView"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleView_articleId_visitorHash_viewBucket_key" ON "ArticleView"("articleId", "visitorHash", "viewBucket");

-- CreateIndex
CREATE INDEX "User_role_isBanned_idx" ON "User"("role", "isBanned");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma DSL cannot express these CHECKs. Keep them in future migrations.
ALTER TABLE "Report" ADD CONSTRAINT "Report_target_check" CHECK (
  ("targetType" = 'ARTICLE' AND "articleId" IS NOT NULL AND "commentId" IS NULL) OR
  ("targetType" = 'COMMENT' AND "commentId" IS NOT NULL AND "articleId" IS NULL)
);
ALTER TABLE "Report" ADD CONSTRAINT "Report_lifecycle_check" CHECK (
  (status = 'OPEN' AND "activeKey" IS NOT NULL AND "resolvedAt" IS NULL AND "resolvedById" IS NULL AND "resolutionNote" IS NULL
    AND "activeKey" = "reporterId" || ':' || "targetType"::text || ':' || coalesce("articleId", "commentId")) OR
  (status <> 'OPEN' AND "activeKey" IS NULL AND "resolvedAt" IS NOT NULL AND "resolvedById" IS NOT NULL)
);
ALTER TABLE "Report" ADD CONSTRAINT "Report_text_check" CHECK (
  char_length(description) <= 2000 AND char_length("resolutionNote") <= 2000 AND
  (reason <> 'OTHER' OR (description IS NOT NULL AND char_length(trim(description)) >= 5))
);
ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_hash_check" CHECK ("visitorHash" ~ '^[a-f0-9]{64}$');
-- Close the login-vs-ban race: this SHARE lock conflicts with ban's User update.
-- Signup's newly inserted User is visible inside its own adapter transaction.
CREATE FUNCTION narra_session_active_user() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE banned boolean;
BEGIN
  SELECT "isBanned" INTO banned FROM "User" WHERE id = NEW."userId" FOR SHARE;
  IF banned IS DISTINCT FROM false THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Session_active_user" BEFORE INSERT ON "Session" FOR EACH ROW EXECUTE FUNCTION narra_session_active_user();
