-- V76: Drop blacklist_reason and blacklist_evidence_url from vehicles

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'blacklist_reason' AND Object_ID = Object_ID(N'dbo.vehicles'))
    ALTER TABLE dbo.vehicles DROP COLUMN blacklist_reason;

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'blacklist_evidence_url' AND Object_ID = Object_ID(N'dbo.vehicles'))
    ALTER TABLE dbo.vehicles DROP COLUMN blacklist_evidence_url;
