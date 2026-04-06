SELECT id, email, is_active, onboarding_status, accepted_cgu, accepted_privacy, must_complete_profile FROM users WHERE onboarding_status = 'pending_validation' LIMIT 10;
