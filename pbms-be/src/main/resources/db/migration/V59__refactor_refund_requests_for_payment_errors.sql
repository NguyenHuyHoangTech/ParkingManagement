-- V59: Refactor refund_requests to support payment error scenarios

-- 1. Drop redundant cancel_time column (we use created_at)
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'cancel_time' AND Object_ID = Object_ID(N'dbo.refund_requests'))
BEGIN
    ALTER TABLE dbo.refund_requests DROP COLUMN cancel_time;
END

-- 2. Expand reference_id to accommodate long transaction IDs from payment gateways
IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'reference_id' AND Object_ID = Object_ID(N'dbo.refund_requests'))
BEGIN
    ALTER TABLE dbo.refund_requests ALTER COLUMN reference_id VARCHAR(255) NOT NULL;
END
