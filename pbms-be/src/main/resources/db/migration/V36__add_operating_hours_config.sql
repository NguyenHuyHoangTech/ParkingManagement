INSERT INTO system_configs (config_key, config_value, description, created_at, updated_at) 
VALUES 
('PARKING_IS_24_7', 'false', 'Is parking operating 24/7?', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('PARKING_OPERATING_START', '06:00', 'Operating start time (HH:mm)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('PARKING_OPERATING_END', '22:30', 'Operating end time (HH:mm)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
