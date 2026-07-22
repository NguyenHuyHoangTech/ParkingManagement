-- V57: Drop orphaned slot_id column from reservations table

-- 1. Drop foreign key constraint on slot_id
DECLARE @ConstraintName NVARCHAR(200)
SELECT @ConstraintName = fk.name 
FROM sys.foreign_keys fk 
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id 
WHERE fkc.parent_object_id = OBJECT_ID('dbo.reservations') 
AND fkc.parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.reservations') AND name = 'slot_id');

IF @ConstraintName IS NOT NULL 
BEGIN
    EXEC('ALTER TABLE dbo.reservations DROP CONSTRAINT ' + @ConstraintName)
END

-- 2. Drop the column
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'slot_id' AND Object_ID = Object_ID(N'dbo.reservations'))
BEGIN
    ALTER TABLE dbo.reservations DROP COLUMN slot_id;
END
