-- V71: Drop global_base_fee from parking_sessions

-- The column is not used anywhere in the frontend or for calculation, 
-- and it is currently populated with NULLs because the billing engine doesn't inject it upon check-out.

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'global_base_fee' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
BEGIN
    ALTER TABLE dbo.parking_sessions DROP COLUMN global_base_fee;
END
