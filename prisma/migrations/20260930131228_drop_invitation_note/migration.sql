-- Helpers can no longer write a comment on their answer (removed from the form); drop the unused column.
ALTER TABLE "Invitation" DROP COLUMN "note";
