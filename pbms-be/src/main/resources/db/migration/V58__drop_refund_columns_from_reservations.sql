-- V58: Drop redundant refund columns from reservations to comply with 3NF

-- 1. Drop foreign key constraint on refunded_by
DECLARE @ConstraintName NVARCHAR(200)
SELECT @ConstraintName = fk.name 
FROM sys.foreign_keys fk 
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id 
WHERE fkc.parent_object_id = OBJECT_ID('dbo.reservations') 
AND fkc.parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.reservations') AND name = 'refunded_by');

IF @ConstraintName IS NOT NULL 
BEGIN
    EXEC('ALTER TABLE dbo.reservations DROP CONSTRAINT ' + @ConstraintName)
END

-- 2. Drop the redundant refund columns
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'refund_status' AND Object_ID = Object_ID(N'dbo.reservations'))
    ALTER TABLE dbo.reservations DROP COLUMN refund_status;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'refund_amount' AND Object_ID = Object_ID(N'dbo.reservations'))
    ALTER TABLE dbo.reservations DROP COLUMN refund_amount;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'refunded_by' AND Object_ID = Object_ID(N'dbo.reservations'))
    ALTER TABLE dbo.reservations DROP COLUMN refunded_by;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'refund_proof_url' AND Object_ID = Object_ID(N'dbo.reservations'))
    ALTER TABLE dbo.reservations DROP COLUMN refund_proof_url;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'refund_reject_reason' AND Object_ID = Object_ID(N'dbo.reservations'))
    ALTER TABLE dbo.reservations DROP COLUMN refund_reject_reason;
