-- V77: Drop floor_level from floors

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'floor_level' AND Object_ID = Object_ID(N'dbo.floors'))
    ALTER TABLE dbo.floors DROP COLUMN floor_level;
