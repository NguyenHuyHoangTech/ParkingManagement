-- V60: Cleanup old unused columns from building_profiles

-- 1. Drop default constraint for is_24_7 if exists
DECLARE @ConstraintName_247 NVARCHAR(200)
SELECT @ConstraintName_247 = d.name
FROM sys.default_constraints d
INNER JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
WHERE d.parent_object_id = OBJECT_ID('dbo.building_profiles') AND c.name = 'is_24_7';

IF @ConstraintName_247 IS NOT NULL 
BEGIN
    EXEC('ALTER TABLE dbo.building_profiles DROP CONSTRAINT ' + @ConstraintName_247)
END

-- 2. Drop the redundant is_24_7 column
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'is_24_7' AND Object_ID = Object_ID(N'dbo.building_profiles'))
BEGIN
    ALTER TABLE dbo.building_profiles DROP COLUMN is_24_7;
END

-- 3. Drop default constraint for operating_hours if exists
DECLARE @ConstraintName_OpHours NVARCHAR(200)
SELECT @ConstraintName_OpHours = d.name
FROM sys.default_constraints d
INNER JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
WHERE d.parent_object_id = OBJECT_ID('dbo.building_profiles') AND c.name = 'operating_hours';

IF @ConstraintName_OpHours IS NOT NULL 
BEGIN
    EXEC('ALTER TABLE dbo.building_profiles DROP CONSTRAINT ' + @ConstraintName_OpHours)
END

-- 4. Drop the redundant operating_hours column
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'operating_hours' AND Object_ID = Object_ID(N'dbo.building_profiles'))
BEGIN
    ALTER TABLE dbo.building_profiles DROP COLUMN operating_hours;
END
