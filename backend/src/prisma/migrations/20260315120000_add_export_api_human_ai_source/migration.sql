-- AlterEnum: add HUMAN_AI to TimeSource
ALTER TYPE "TimeSource" ADD VALUE 'HUMAN_AI';

-- AlterTable: add AI fields to issues
ALTER TABLE "issues" ADD COLUMN "ai_plan" TEXT;
ALTER TABLE "issues" ADD COLUMN "ai_dev_result" TEXT;
ALTER TABLE "issues" ADD COLUMN "ai_test_result" TEXT;

-- CreateEnum
CREATE TYPE "DevLinkType" AS ENUM ('COMMIT', 'BRANCH', 'PULL_REQUEST', 'MERGE');

-- CreateTable
CREATE TABLE "dev_links" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "type" "DevLinkType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "sha" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dev_links_issue_id_idx" ON "dev_links"("issue_id");

-- AddForeignKey
ALTER TABLE "dev_links" ADD CONSTRAINT "dev_links_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
