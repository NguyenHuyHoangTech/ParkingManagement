-- V52: Drop is_verified column from users table

DECLARE @ConstraintName nvarchar(200);
SELECT @ConstraintName = Name 
FROM sys.default_constraints 
WHERE parent_object_id = OBJECT_ID('dbo.users') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.users'), 'is_verified', 'ColumnId');

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.users DROP CONSTRAINT ' + @ConstraintName);
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'is_verified' AND Object_ID = Object_ID(N'dbo.users'))
BEGIN
    ALTER TABLE dbo.users DROP COLUMN is_verified;
END
