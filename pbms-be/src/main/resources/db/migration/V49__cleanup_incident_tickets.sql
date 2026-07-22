-- V49: Cleanup incident_tickets table (drop redundant columns and alter URL column)

DECLARE @sql NVARCHAR(MAX) = N'';

-- 1. Drop constraints and column for 'assigned_staff_id'
SELECT @sql += N'ALTER TABLE dbo.incident_tickets DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.incident_tickets') AND c.name = 'assigned_staff_id';

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'assigned_staff_id' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.incident_tickets DROP COLUMN assigned_staff_id;';
END

-- 2. Drop constraints and column for 'parking_session_id'
SELECT @sql += N'ALTER TABLE dbo.incident_tickets DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.incident_tickets') AND c.name = 'parking_session_id';

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'parking_session_id' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.incident_tickets DROP COLUMN parking_session_id;';
END

-- 3. Drop constraints and column for 'reported_by_id'
SELECT @sql += N'ALTER TABLE dbo.incident_tickets DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.incident_tickets') AND c.name = 'reported_by_id';

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'reported_by_id' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.incident_tickets DROP COLUMN reported_by_id;';
END

-- 4. Alter uploaded_card_url to VARCHAR(MAX)
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'uploaded_card_url' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.incident_tickets ALTER COLUMN uploaded_card_url VARCHAR(MAX);';
END

IF @sql <> N'' 
BEGIN
    EXEC sp_executesql @sql;
END
