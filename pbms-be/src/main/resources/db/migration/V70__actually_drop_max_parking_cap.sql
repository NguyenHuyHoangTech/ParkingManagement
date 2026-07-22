-- V70: Drop max_parking_cap from pricing_policies because V42 missed dropping constraint correctly due to SQL execution flow

DECLARE @sql NVARCHAR(MAX) = N'';
DECLARE @ConstraintName nvarchar(200);

-- Find the default constraint on max_parking_cap
SELECT @ConstraintName = Name 
FROM sys.default_constraints 
WHERE parent_object_id = OBJECT_ID('dbo.pricing_policies') 
  AND parent_column_id = (SELECT column_id FROM sys.columns WHERE NAME = N'max_parking_cap' AND object_id = OBJECT_ID(N'dbo.pricing_policies'));

IF @ConstraintName IS NOT NULL
BEGIN
    SET @sql += N'ALTER TABLE dbo.pricing_policies DROP CONSTRAINT ' + @ConstraintName + '; ';
END

-- Execute the constraint drop
IF @sql <> N'' 
BEGIN
    EXEC sp_executesql @sql;
END

-- Drop the column
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'max_parking_cap' AND Object_ID = Object_ID(N'dbo.pricing_policies'))
BEGIN
    ALTER TABLE dbo.pricing_policies DROP COLUMN max_parking_cap;
END
