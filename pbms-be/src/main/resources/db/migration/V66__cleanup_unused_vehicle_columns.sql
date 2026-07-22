-- Xóa các cột không sử dụng trong bảng vehicles
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS FKgqjc8pmwiyjslyyf2dnkpdgcs;
ALTER TABLE vehicles DROP COLUMN IF EXISTS customer_id;
ALTER TABLE vehicles DROP COLUMN IF EXISTS color;
ALTER TABLE vehicles DROP COLUMN IF EXISTS brand;
