-- V55: Drop discrepancy columns from staff_work_sessions

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'actual_revenue' AND Object_ID = Object_ID(N'dbo.staff_work_sessions'))
BEGIN
    ALTER TABLE dbo.staff_work_sessions DROP COLUMN actual_revenue;
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'revenue_variance' AND Object_ID = Object_ID(N'dbo.staff_work_sessions'))
BEGIN
    ALTER TABLE dbo.staff_work_sessions DROP COLUMN revenue_variance;
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'variance_reason' AND Object_ID = Object_ID(N'dbo.staff_work_sessions'))
BEGIN
    ALTER TABLE dbo.staff_work_sessions DROP COLUMN variance_reason;
END

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'discrepancy_status' AND Object_ID = Object_ID(N'dbo.staff_work_sessions'))
BEGIN
    ALTER TABLE dbo.staff_work_sessions DROP COLUMN discrepancy_status;
END
