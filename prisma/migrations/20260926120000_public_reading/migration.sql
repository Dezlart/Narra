ALTER TABLE "ArticleRevision" ADD COLUMN "readingMinutes" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_readingMinutes_check" CHECK ("readingMinutes" >= 1);

-- Backfill derived metadata only; all content and publication pointers stay intact.
-- Strict JSONPath avoids recursive lax-mode array unwrapping duplicates.
UPDATE "ArticleRevision" r SET "readingMinutes" = GREATEST(1, CEIL((
  SELECT COALESCE(SUM(cardinality(regexp_split_to_array(trim(v #>> '{}'), '[[:space:]]+')))
    FILTER (WHERE trim(v #>> '{}') <> ''), 0)
  FROM jsonb_path_query(r.content, 'strict $.** ? (@.type == "text").text') AS t(v)
) / 200.0)::integer) WHERE r.status = 'APPROVED';
