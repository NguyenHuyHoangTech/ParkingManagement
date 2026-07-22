-- V56: Cleanup orphaned columns from audit_logs table

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'action_type' AND Object_ID = Object_ID(N'dbo.audit_logs'))
BEGIN
    ALTER TABLE dbo.audit_logs DROP COLUMN action_type;
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'target_entity' AND Object_ID = Object_ID(N'dbo.audit_logs'))
BEGIN
    ALTER TABLE dbo.audit_logs DROP COLUMN target_entity;
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'target_id' AND Object_ID = Object_ID(N'dbo.audit_logs'))
BEGIN
    ALTER TABLE dbo.audit_logs DROP COLUMN target_id;
END
