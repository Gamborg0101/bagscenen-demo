-- Open shifts replace invitations: an invitation nobody answered now means the same as no row
-- ("Har ikke svaret"). Answers (accepted/declined) and their shifts are kept.
DELETE FROM "Invitation" i
WHERE i.status = 'PENDING'
  AND i."respondedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Availability" a WHERE a."invitationId" = i.id);
