-- V50: Drop expected_zone_id and actual_zone_id from incident_tickets

DECLARE @sql NVARCHAR(MAX) = N'';

-- 1. Drop constraints and column for 'expected_zone_id'
SELECT @sql += N'ALTER TABLE dbo.incident_tickets DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.incident_tickets') AND c.name = 'expected_zone_id';

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'expected_zone_id' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.incident_tickets DROP COLUMN expected_zone_id;';
END

-- 2. Drop constraints and column for 'actual_zone_id'
SELECT @sql += N'ALTER TABLE dbo.incident_tickets DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.incident_tickets') AND c.name = 'actual_zone_id';

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'actual_zone_id' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.incident_tickets DROP COLUMN actual_zone_id;';
END

IF @sql <> N'' 
BEGIN
    EXEC sp_executesql @sql;
END
