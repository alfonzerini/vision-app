-- ============================================================================
-- Vision — Enable realtime on messages (migration 0009)
-- ============================================================================
-- Lets the chat update live for both parties. Realtime still enforces RLS, so
-- a user only receives messages they're allowed to see.
-- ============================================================================

alter publication supabase_realtime add table messages;
