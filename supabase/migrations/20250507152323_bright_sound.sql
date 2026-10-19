/*
  Intentionally empty.

  This migration was an exact duplicate of 20250507151356_warm_tooth.sql
  (profiles table + auth trigger). Re-running it fails on a fresh database
  because the policies and trigger already exist, so its body was removed.
  The file is kept so migration history stays aligned on databases that
  already recorded this version.
*/
SELECT 1;
