-- Xóa cột overflow_threshold bị dư thừa trong bảng zones vì đã được thay thế bởi routing_rules.fill_threshold_pct
ALTER TABLE zones
DROP COLUMN overflow_threshold;
