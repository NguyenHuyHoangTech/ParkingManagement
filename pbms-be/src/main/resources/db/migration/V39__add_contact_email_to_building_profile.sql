ALTER TABLE building_profiles
ADD contact_email VARCHAR(100);
GO

UPDATE building_profiles SET contact_email = 'support@pbms.vn' WHERE contact_email IS NULL;
GO
