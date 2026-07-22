-- 1. Add new columns
ALTER TABLE monthly_tickets ADD plate_number VARCHAR(50);
ALTER TABLE monthly_tickets ADD vehicle_type_id BIGINT;

GO

-- 2. Generate random valid data for existing null records
-- Give them a fake plate number based on their ID to keep it unique
UPDATE monthly_tickets
SET plate_number = CONCAT('51X-', 10000 + id),
    -- Grab the first available vehicle type ID (usually 1 or 2, fallback to 1)
    vehicle_type_id = COALESCE((SELECT TOP 1 id FROM vehicle_types ORDER BY id), 1)
WHERE plate_number IS NULL;

GO

-- 3. Add NOT NULL constraints and Foreign Key now that data is populated
ALTER TABLE monthly_tickets ALTER COLUMN plate_number VARCHAR(50) NOT NULL;
ALTER TABLE monthly_tickets ALTER COLUMN vehicle_type_id BIGINT NOT NULL;

ALTER TABLE monthly_tickets ADD CONSTRAINT fk_monthly_ticket_vehicle_type FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id);

GO

-- 4. Find and Drop the foreign key constraint on vehicle_id
DECLARE @ConstraintName nvarchar(200);
SELECT @ConstraintName = Name 
FROM sys.foreign_keys 
WHERE parent_object_id = OBJECT_ID('monthly_tickets') 
  AND referenced_object_id = OBJECT_ID('vehicles');

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE monthly_tickets DROP CONSTRAINT ' + @ConstraintName);
END

GO

-- 5. Drop the vehicle_id column
ALTER TABLE monthly_tickets DROP COLUMN vehicle_id;

GO
