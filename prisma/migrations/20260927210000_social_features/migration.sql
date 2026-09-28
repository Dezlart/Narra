-- CreateTable
CREATE TABLE "Like" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "requestId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Like_articleId_idx" ON "Like"("articleId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_articleId_idx" ON "Bookmark"("userId", "createdAt" DESC, "articleId");

-- CreateIndex
CREATE INDEX "Bookmark_articleId_idx" ON "Bookmark"("articleId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "Comment_articleId_parentId_createdAt_id_idx" ON "Comment"("articleId", "parentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Comment_authorId_createdAt_idx" ON "Comment"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_createdAt_id_idx" ON "Comment"("createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Comment_hiddenById_idx" ON "Comment"("hiddenById");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_articleId_id_key" ON "Comment"("articleId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_authorId_requestId_key" ON "Comment"("authorId", "requestId");

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_articleId_parentId_fkey" FOREIGN KEY ("articleId", "parentId") REFERENCES "Comment"("articleId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Domain constraints not representable by the Prisma schema DSL.
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_not_self" CHECK ("followerId" <> "followingId");
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_not_self_parent" CHECK ("parentId" IS NULL OR "parentId" <> id);
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_content_bounds" CHECK (
  char_length(content) <= 2000 AND ("deletedAt" IS NOT NULL OR length(btrim(content)) > 0)
);

CREATE FUNCTION narra_comment_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."articleId" IS DISTINCT FROM OLD."articleId" OR NEW."parentId" IS DISTINCT FROM OLD."parentId") THEN
    RAISE EXCEPTION 'Comment parent and article are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."parentId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "Comment" WHERE id = NEW."parentId" AND "parentId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Only one reply level is allowed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Comment_parent_guard" BEFORE INSERT OR UPDATE OF "parentId", "articleId"
  ON "Comment" FOR EACH ROW EXECUTE FUNCTION narra_comment_parent_guard();
