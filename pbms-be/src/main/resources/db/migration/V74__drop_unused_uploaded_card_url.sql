-- V74: Drop unused uploaded_card_url from incident_tickets

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'uploaded_card_url' AND Object_ID = Object_ID(N'dbo.incident_tickets'))
BEGIN
    ALTER TABLE dbo.incident_tickets DROP COLUMN uploaded_card_url;
END
