/*
  # Create test admin account

  1. Changes
    - Insert test admin user into auth.users
    - Set up admin profile with enterprise role
    - Add initial credits

  Note: This is for testing purposes only
*/

-- Insert test admin user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'c9d53d6d-7c99-4bd0-8103-4a9f83b6b1fc',
  'authenticated',
  'authenticated',
  'admin@intuity.ai',
  '$2a$10$PxXHyH8YHGQcw1PVyfTxYOPVK7xQTyuNHjJHJTe8g5V.9QBxbICOm', -- Password: Admin123!
  now(),
  now(),
  now()
);

-- Insert admin profile
INSERT INTO public.profiles (
  id,
  email,
  role,
  credits
) VALUES (
  'c9d53d6d-7c99-4bd0-8103-4a9f83b6b1fc',
  'admin@intuity.ai',
  'enterprise',
  10000
);