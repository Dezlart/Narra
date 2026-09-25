-- AlterTable
ALTER TABLE "ArticleRevision" ADD COLUMN     "editVersion" INTEGER NOT NULL DEFAULT 0;

-- One editable draft per article. ArticleRevision.version remains its historical number.
CREATE UNIQUE INDEX "ArticleRevision_one_draft_per_article" ON "ArticleRevision"("articleId") WHERE "status" = 'DRAFT';
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_editVersion_nonnegative" CHECK ("editVersion" >= 0);

-- CreateTable
CREATE TABLE "ArticleImage" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleImage_pathname_key" ON "ArticleImage"("pathname");

-- CreateIndex
CREATE INDEX "ArticleImage_articleId_idx" ON "ArticleImage"("articleId");

-- AddForeignKey
ALTER TABLE "ArticleImage" ADD CONSTRAINT "ArticleImage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
