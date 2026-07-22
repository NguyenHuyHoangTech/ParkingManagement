-- V46: Cleanup Legacy Columns and Refactor to 3NF

-- Helper procedure to drop constraint by column name
DECLARE @DropConstraints NVARCHAR(MAX) = N'';
SELECT @DropConstraints += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.parking_sessions') 
  AND fkc.parent_column_id IN (
      SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.parking_sessions') AND name IN ('entry_gate_id', 'exit_gate_id', 'slot_id', 'vehicle_id')
  );
EXEC sp_executesql @DropConstraints;

-- 1. Drop unused legacy columns from parking_sessions if they still exist (from old caching/outdated local DBs)
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'entry_time' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN entry_time;
    
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'exit_time' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN exit_time;
    
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'entry_gate_id' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN entry_gate_id;
    
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'exit_gate_id' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN exit_gate_id;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'entry_image_url' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN entry_image_url;
    
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'exit_image_url' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN exit_image_url;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'lpr_image_in' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN lpr_image_in;
    
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'lpr_image_out' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN lpr_image_out;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'base_fee' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN base_fee;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'vehicle_id' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN vehicle_id;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'suggested_zone_name' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN suggested_zone_name;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'slot_id' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN slot_id;

-- 3. Drop plate, vehicle_type_id from monthly_tickets (3NF refactoring)
-- Drop FK for vehicle_type_id
DECLARE @DropMTConstraints NVARCHAR(MAX) = N'';
SELECT @DropMTConstraints += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.monthly_tickets') 
  AND fkc.parent_column_id IN (
      SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.monthly_tickets') AND name IN ('vehicle_type_id')
  );
EXEC sp_executesql @DropMTConstraints;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'plate' AND Object_ID = Object_ID(N'dbo.monthly_tickets'))
    ALTER TABLE dbo.monthly_tickets DROP COLUMN plate;
    
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'vehicle_type_id' AND Object_ID = Object_ID(N'dbo.monthly_tickets'))
    ALTER TABLE dbo.monthly_tickets DROP COLUMN vehicle_type_id;
    
-- Note: rfid_card_id IS REQUIRED in monthly_tickets! Removed the drop.

-- 4. Optimize URL column Data Types (VARCHAR(MAX) -> VARCHAR(500))
-- First, nullify any legacy Base64 string that exceeds 500 characters to prevent truncation error
UPDATE dbo.parking_sessions SET pic_in_panorama = NULL WHERE LEN(pic_in_panorama) > 500;
UPDATE dbo.parking_sessions SET pic_in_face = NULL WHERE LEN(pic_in_face) > 500;
UPDATE dbo.parking_sessions SET pic_out_panorama = NULL WHERE LEN(pic_out_panorama) > 500;
UPDATE dbo.parking_sessions SET pic_out_face = NULL WHERE LEN(pic_out_face) > 500;

UPDATE dbo.incident_tickets SET uploaded_doc_url = NULL WHERE LEN(uploaded_doc_url) > 500;
UPDATE dbo.incident_tickets SET resolution_image_url = NULL WHERE LEN(resolution_image_url) > 500;

UPDATE dbo.vehicles SET blacklist_evidence_url = NULL WHERE LEN(blacklist_evidence_url) > 500;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'pic_in_panorama' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions ALTER COLUMN pic_in_panorama VARCHAR(500);
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'pic_in_face' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions ALTER COLUMN pic_in_face VARCHAR(500);
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'pic_out_panorama' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions ALTER COLUMN pic_out_panorama VARCHAR(500);
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'pic_out_face' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions ALTER COLUMN pic_out_face VARCHAR(500);

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'uploaded_doc_url' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
    ALTER TABLE dbo.incident_tickets ALTER COLUMN uploaded_doc_url VARCHAR(500);
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'resolution_image_url' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
    ALTER TABLE dbo.incident_tickets ALTER COLUMN resolution_image_url VARCHAR(500);

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'blacklist_evidence_url' AND Object_ID = Object_ID(N'dbo.vehicles'))
    ALTER TABLE dbo.vehicles ALTER COLUMN blacklist_evidence_url VARCHAR(500);
