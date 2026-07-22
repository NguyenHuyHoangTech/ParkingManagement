-- V53: Cleanup staff_work_sessions table (drop work_gate_type and alter variance_reason)

DECLARE @sql NVARCHAR(MAX) = N'';

-- 1. Drop constraints and column for 'work_gate_type'
SELECT @sql += N'ALTER TABLE dbo.staff_work_sessions DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.staff_work_sessions') AND c.name = 'work_gate_type';

DECLARE @ConstraintName nvarchar(200);
SELECT @ConstraintName = Name 
FROM sys.default_constraints 
WHERE parent_object_id = OBJECT_ID('dbo.staff_work_sessions') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.staff_work_sessions'), 'work_gate_type', 'ColumnId');

IF @ConstraintName IS NOT NULL
BEGIN
    SET @sql += N'ALTER TABLE dbo.staff_work_sessions DROP CONSTRAINT ' + @ConstraintName + ';';
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'work_gate_type' AND Object_ID = Object_ID(N'dbo.staff_work_sessions'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.staff_work_sessions DROP COLUMN work_gate_type;';
END

-- 2. Alter variance_reason to VARCHAR(MAX) to prevent truncation
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'variance_reason' AND Object_ID = Object_ID(N'dbo.staff_work_sessions'))
BEGIN
    SET @sql += N'ALTER TABLE dbo.staff_work_sessions ALTER COLUMN variance_reason VARCHAR(MAX);';
END

IF @sql <> N'' 
BEGIN
    EXEC sp_executesql @sql;
END
