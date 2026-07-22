-- V72: Rename total_fee to parking_fee in parking_sessions for clearer semantics

IF EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'total_fee' AND Object_ID = Object_ID(N'dbo.parking_sessions'))
BEGIN
    EXEC sp_rename 'dbo.parking_sessions.total_fee', 'parking_fee', 'COLUMN';
END
