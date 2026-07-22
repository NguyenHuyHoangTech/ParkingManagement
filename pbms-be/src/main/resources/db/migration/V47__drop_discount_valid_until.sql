-- V47: Drop unused discount_valid_until column from parking_sessions

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'discount_valid_until' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
    ALTER TABLE dbo.parking_sessions DROP COLUMN discount_valid_until;
