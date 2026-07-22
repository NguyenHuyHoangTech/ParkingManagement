-- V73: Drop unused columns from monthly_tickets

-- Drop FK for rfid_card_id
DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = fk.name 
FROM sys.foreign_keys fk 
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id 
WHERE fkc.parent_object_id = OBJECT_ID('dbo.monthly_tickets') 
  AND fkc.parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.monthly_tickets') AND name = 'rfid_card_id');

IF @ConstraintName IS NOT NULL 
    EXEC('ALTER TABLE dbo.monthly_tickets DROP CONSTRAINT ' + @ConstraintName);

-- Drop Default Constraint for auto_renew
DECLARE @DefaultConstraintName NVARCHAR(200);
SELECT @DefaultConstraintName = df.name
FROM sys.default_constraints df
INNER JOIN sys.columns c ON df.parent_object_id = c.object_id AND df.parent_column_id = c.column_id
WHERE df.parent_object_id = OBJECT_ID('dbo.monthly_tickets') AND c.name = 'auto_renew';

IF @DefaultConstraintName IS NOT NULL
    EXEC('ALTER TABLE dbo.monthly_tickets DROP CONSTRAINT ' + @DefaultConstraintName);

-- Drop columns
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'rfid_card_id' AND Object_ID = Object_ID(N'dbo.monthly_tickets'))
    ALTER TABLE dbo.monthly_tickets DROP COLUMN rfid_card_id;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'auto_renew' AND Object_ID = Object_ID(N'dbo.monthly_tickets'))
    ALTER TABLE dbo.monthly_tickets DROP COLUMN auto_renew;
