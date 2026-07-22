-- Xóa cột capacity bị dư thừa trong bảng floors (sức chứa thực tế được tính bằng COUNT trên bảng slots)
ALTER TABLE floors
DROP COLUMN capacity;
