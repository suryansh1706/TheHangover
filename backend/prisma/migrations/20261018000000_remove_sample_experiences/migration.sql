DELETE FROM "Experience"
WHERE "isSample" = TRUE
   OR "source" IN ('sample', 'development-sample')
   OR "slug" LIKE 'sample-%';

ALTER TABLE "Experience" DROP COLUMN "isSample";
ALTER TABLE "Experience" ALTER COLUMN "source" SET DEFAULT 'unknown';
