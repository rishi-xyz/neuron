/*
  Warnings:

  - Made the column `derivedEntitySourceId` on table `ConversationReference` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ConversationReference" ALTER COLUMN "derivedEntitySourceId" SET NOT NULL,
ALTER COLUMN "derivedEntitySourceId" SET DEFAULT '';
