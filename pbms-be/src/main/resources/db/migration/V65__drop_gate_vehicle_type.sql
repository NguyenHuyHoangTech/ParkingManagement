-- Xóa cột vehicle_type_id trong bảng gates vì cổng không phụ thuộc vào 1 loại xe cụ thể mà phụ thuộc vào floor_type (loại tầng)
ALTER TABLE gates
DROP CONSTRAINT IF EXISTS FK_gates_vehicle_types;

ALTER TABLE gates
DROP COLUMN vehicle_type_id;
