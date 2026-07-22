-- Xóa các cột không sử dụng trong bảng zone_hourly_trends
ALTER TABLE zone_hourly_trends
DROP COLUMN revenue_generated, entries_count, exits_count;
