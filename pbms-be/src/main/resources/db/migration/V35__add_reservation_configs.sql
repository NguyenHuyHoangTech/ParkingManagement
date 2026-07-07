-- Add configuration for late refund percentage
IF NOT EXISTS (SELECT 1 FROM dbo.system_configs WHERE config_key = 'RESERVATION_REFUND_LATE_PERCENT')
BEGIN
    INSERT INTO dbo.system_configs (config_key, config_value, description, created_at, updated_at)
    VALUES ('RESERVATION_REFUND_LATE_PERCENT', '0.5', 'Refund percentage when a reservation is cancelled late (e.g. 0.5 for 50%)', GETDATE(), GETDATE());
END
GO

-- Add configuration for early refund percentage
IF NOT EXISTS (SELECT 1 FROM dbo.system_configs WHERE config_key = 'RESERVATION_REFUND_EARLY_PERCENT')
BEGIN
    INSERT INTO dbo.system_configs (config_key, config_value, description, created_at, updated_at)
    VALUES ('RESERVATION_REFUND_EARLY_PERCENT', '1.0', 'Refund percentage when a reservation is cancelled early (e.g. 1.0 for 100%)', GETDATE(), GETDATE());
END
GO

-- Add configuration for default reservation duration
IF NOT EXISTS (SELECT 1 FROM dbo.system_configs WHERE config_key = 'RESERVATION_DEFAULT_DURATION_MINS')
BEGIN
    INSERT INTO dbo.system_configs (config_key, config_value, description, created_at, updated_at)
    VALUES ('RESERVATION_DEFAULT_DURATION_MINS', '120', 'Default expected duration for a reservation in minutes if not specified', GETDATE(), GETDATE());
END
GO
