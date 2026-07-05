DECLARE @ConstraintName nvarchar(200)

-- Find the system-generated unique constraint name for qr_code column
SELECT @ConstraintName = kc.name
FROM sys.key_constraints kc
JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE kc.type = 'UQ' 
  AND kc.parent_object_id = OBJECT_ID('reservations') 
  AND c.name = 'qr_code'

-- Drop the unique constraint if it exists
IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE reservations DROP CONSTRAINT ' + @ConstraintName)
END

-- Drop the column
ALTER TABLE reservations DROP COLUMN qr_code;
