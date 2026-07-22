-- V69: Cleanup unused columns in payment_orders

DECLARE @sql NVARCHAR(MAX) = N'';

-- 1. Drop foreign key constraints dynamically
DECLARE @FkName NVARCHAR(200);

-- Cursor to find all FKs for reservation_id and monthly_ticket_id
DECLARE fk_cursor CURSOR FOR
SELECT fk.name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.payment_orders')
  AND c.name IN ('reservation_id', 'monthly_ticket_id');

OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @FkName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql += N'ALTER TABLE dbo.payment_orders DROP CONSTRAINT ' + @FkName + '; ';
    FETCH NEXT FROM fk_cursor INTO @FkName;
END

CLOSE fk_cursor;
DEALLOCATE fk_cursor;

IF @sql <> N'' 
BEGIN
    EXEC sp_executesql @sql;
END

-- 2. Drop the columns
ALTER TABLE payment_orders DROP COLUMN IF EXISTS reservation_id;
ALTER TABLE payment_orders DROP COLUMN IF EXISTS monthly_ticket_id;
