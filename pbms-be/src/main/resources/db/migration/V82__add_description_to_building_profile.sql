ALTER TABLE building_profiles ADD description NVARCHAR(MAX);
GO

UPDATE building_profiles
SET name = N'Smart space.',
    description = N'Smart Parking Facility Parking easier than ever. Real-time empty slot updates, smart AI navigation, and automated payment via License Plate Recognition (LPR).';
GO
