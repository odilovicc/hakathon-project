ALTER TABLE profiles ADD COLUMN onboarding_step INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_step BETWEEN 0 AND 6);
UPDATE profiles SET onboarding_step = 6 WHERE onboarding_done = 1;
