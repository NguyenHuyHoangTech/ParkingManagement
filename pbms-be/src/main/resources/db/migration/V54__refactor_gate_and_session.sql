-- V54: Refactor Gate type to StaffWorkSession

DECLARE @sql NVARCHAR(MAX) = N'';

-- 1. Drop gate_type and live_override_mode constraints in gates table
-- Find and drop default constraints for gate_type and live_override_mode
DECLARE @ConstraintName nvarchar(200);

SELECT @ConstraintName = Name 
FROM sys.default_constraints 
WHERE parent_object_id = OBJECT_ID('dbo.gates') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.gates'), 'gate_type', 'ColumnId');
IF @ConstraintName IS NOT NULL
BEGIN
    SET @sql += N'ALTER TABLE dbo.gates DROP CONSTRAINT ' + @ConstraintName + ';';
END

SELECT @ConstraintName = Name 
FROM sys.default_constraints 
WHERE parent_object_id = OBJECT_ID('dbo.gates') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.gates'), 'live_override_mode', 'ColumnId');
IF @ConstraintName IS NOT NULL
BEGIN
    SET @sql += N'ALTER TABLE dbo.gates DROP CONSTRAINT ' + @ConstraintName + ';';
END

IF @sql <> N'' 
BEGIN
    EXEC sp_executesql @sql;
END

-- Drop columns from gates
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'gate_type' AND Object_ID = Object_ID(N'dbo.gates'))
BEGIN
    ALTER TABLE dbo.gates DROP COLUMN gate_type;
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'live_override_mode' AND Object_ID = Object_ID(N'dbo.gates'))
BEGIN
    ALTER TABLE dbo.gates DROP COLUMN live_override_mode;
END

-- 2. Add work_gate_type to staff_work_sessions table
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'work_gate_type' AND Object_ID = Object_ID(N'dbo.staff_work_sessions'))
BEGIN
    ALTER TABLE dbo.staff_work_sessions ADD work_gate_type VARCHAR(50);
END
