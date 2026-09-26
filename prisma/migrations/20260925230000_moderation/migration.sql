-- A pending submission occupies the same working slot as an editable draft.
-- Historical APPROVED/REJECTED revisions are unrestricted. No data is rewritten.
CREATE UNIQUE INDEX "ArticleRevision_one_active_per_article"
ON "ArticleRevision"("articleId") WHERE "status" IN ('DRAFT', 'PENDING');
