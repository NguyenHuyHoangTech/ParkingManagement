-- V51: Drop fee_paused_at from incident_tickets

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'fee_paused_at' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    ALTER TABLE dbo.incident_tickets DROP COLUMN fee_paused_at;
END
