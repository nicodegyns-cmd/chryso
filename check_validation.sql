-- Check validation status
SELECT 
  id, 
  email, 
  is_active, 
  onboarding_status,
  accepted_cgu,
  accepted_privacy,
  must_complete_profile
FROM users 
WHERE email ILIKE '%nicodegyns%' 
ORDER BY id DESC;
