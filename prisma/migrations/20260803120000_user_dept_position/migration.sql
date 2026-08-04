-- Add department and position columns to users
ALTER TABLE `users` ADD COLUMN `dept` VARCHAR(64) NULL AFTER `phone`;
ALTER TABLE `users` ADD COLUMN `position` VARCHAR(64) NULL AFTER `dept`;

-- Migrate existing data: pay_employee_profile → workers fallback
UPDATE `users` u
LEFT JOIN `pay_employee_profile` pep ON pep.user_id = u.id
LEFT JOIN `workers` w ON w.id = u.worker_id
SET
  u.dept = COALESCE(NULLIF(TRIM(pep.dept), ''), NULLIF(TRIM(w.team), '')),
  u.position = COALESCE(NULLIF(TRIM(pep.position), ''), NULLIF(TRIM(w.position), ''));
