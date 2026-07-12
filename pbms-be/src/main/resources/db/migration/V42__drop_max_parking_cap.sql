DECLARE @ConstraintName nvarchar(200)
SELECT @ConstraintName = Name FROM SYS.DEFAULT_CONSTRAINTS WHERE PARENT_OBJECT_ID = OBJECT_ID('pricing_policies') AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = N'max_parking_cap' AND object_id = OBJECT_ID(N'pricing_policies'))
IF @ConstraintName IS NOT NULL
    EXEC('ALTER TABLE pricing_policies DROP CONSTRAINT ' + @ConstraintName)
GO

ALTER TABLE pricing_policies DROP COLUMN max_parking_cap;
GO
