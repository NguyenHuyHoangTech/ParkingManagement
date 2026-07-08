-- Remove previously added system configs
DELETE FROM system_configs WHERE config_key IN ('PARKING_IS_24_7', 'PARKING_OPERATING_START', 'PARKING_OPERATING_END');

-- Update building_profiles table
ALTER TABLE building_profiles DROP COLUMN operating_hours;

ALTER TABLE building_profiles 
ADD is_24_7 BIT DEFAULT 0 NOT NULL,
    operating_start VARCHAR(5) DEFAULT '06:00' NOT NULL,
    operating_end VARCHAR(5) DEFAULT '22:30' NOT NULL;
