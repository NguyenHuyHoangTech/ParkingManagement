-- V81__translate_all_remaining_vietnamese_data.sql
-- Ensure all seed data is completely translated to English with Unicode prefixes for SQL Server

-- Update Users
UPDATE users SET full_name = 'System Administrator' WHERE full_name LIKE N'%Quản Trị Hệ Thống%' OR full_name = 'Quan Tri He Thong';
UPDATE users SET full_name = 'Manager' WHERE full_name LIKE N'%Quản Lý%' OR full_name = 'Quan Ly';
UPDATE users SET full_name = 'Staff 1' WHERE full_name LIKE N'%Nhân Viên 1%' OR full_name = 'Nhan Vien 1';
UPDATE users SET full_name = 'Customer 1' WHERE full_name LIKE N'%Khách Hàng 1%' OR full_name = 'Khach Hang 1';
UPDATE users SET full_name = 'Nguyen Van A' WHERE full_name LIKE N'%Nguyễn Văn A%';
UPDATE users SET full_name = 'Tran Thi B' WHERE full_name LIKE N'%Trần Thị B%';
UPDATE users SET full_name = 'Le Van C' WHERE full_name LIKE N'%Lê Văn C%';
UPDATE users SET full_name = 'Pham Thi D' WHERE full_name LIKE N'%Phạm Thị D%';

-- Update Vehicle Types
UPDATE vehicle_types SET type_name = '4-wheel Car' WHERE type_name LIKE N'%Ô tô 4 bánh%' OR type_name LIKE N'%Ô Tô%';
UPDATE vehicle_types SET type_name = '2-wheel Vehicle' WHERE type_name LIKE N'%Xe 2 bánh%' OR type_name LIKE N'%Xe Máy%';
UPDATE vehicle_types SET type_name = 'Electric Bike' WHERE type_name LIKE N'%Xe điện%' OR type_name LIKE N'%Xe Điện%';
UPDATE vehicle_types SET type_name = 'Car' WHERE type_name LIKE N'%Ô tô%' OR type_name LIKE N'%Ô Tô%';
UPDATE vehicle_types SET type_name = 'Motorbike' WHERE type_name LIKE N'%Xe máy%' OR type_name LIKE N'%Xe Máy%';

-- Update Pricing Policies
UPDATE pricing_policies SET policy_name = 'Standard Car Pricing' WHERE policy_name LIKE N'%Bảng Giá Ô Tô Chuẩn%' OR policy_name LIKE N'%Bảng giá Ô tô tiêu chuẩn%';
UPDATE pricing_policies SET policy_name = 'Standard Motorbike Pricing' WHERE policy_name LIKE N'%Bảng Giá Xe Máy Chuẩn%' OR policy_name LIKE N'%Bảng giá Xe máy tiêu chuẩn%';
UPDATE pricing_policies SET policy_name = 'VIP Car Pricing' WHERE policy_name LIKE N'%Bảng Giá Ô Tô VIP%';
UPDATE pricing_policies SET policy_name = 'VIP Motorbike Pricing' WHERE policy_name LIKE N'%Bảng Giá Xe Máy VIP%';

-- Update Zones
UPDATE zones SET zone_name = 'Car Zone A' WHERE zone_name LIKE N'%Khu Vực Ô Tô A%';
UPDATE zones SET zone_name = 'Motorbike Zone B' WHERE zone_name LIKE N'%Khu Vực Xe Máy B%';
UPDATE zones SET zone_name = 'VIP Zone' WHERE zone_name LIKE N'%Khu Vực VIP%';

-- Update Gates
UPDATE gates SET gate_name = 'Main Entry Gate' WHERE gate_name LIKE N'%Cổng Vào Chính%';
UPDATE gates SET gate_name = 'Main Exit Gate' WHERE gate_name LIKE N'%Cổng Ra Chính%';
UPDATE gates SET gate_name = 'VIP Gate' WHERE gate_name LIKE N'%Cổng VIP%';
UPDATE gates SET gate_name = 'Patrol Duty' WHERE gate_name LIKE N'%Tuần tra%';

-- Update Pricing Shifts
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'pricing_shifts')
BEGIN
    UPDATE pricing_shifts SET shift_name = 'Morning' WHERE shift_name LIKE N'%Sáng%';
    UPDATE pricing_shifts SET shift_name = 'Afternoon' WHERE shift_name LIKE N'%Chiều%';
    UPDATE pricing_shifts SET shift_name = 'Evening' WHERE shift_name LIKE N'%Tối%';
    UPDATE pricing_shifts SET shift_name = 'Night' WHERE shift_name LIKE N'%Đêm%';
    UPDATE pricing_shifts SET shift_name = 'All Day' WHERE shift_name LIKE N'%Cả Ngày%';
END
