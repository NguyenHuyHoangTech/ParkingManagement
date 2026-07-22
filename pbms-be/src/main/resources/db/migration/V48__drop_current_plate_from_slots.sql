-- V48: Drop unused current_plate column from slots

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'current_plate' AND Object_ID = Object_ID(N'dbo.slots'))
    ALTER TABLE dbo.slots DROP COLUMN current_plate;
