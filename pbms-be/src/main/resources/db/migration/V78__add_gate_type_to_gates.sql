-- V78__add_gate_type_to_gates.sql

IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'gate_type' AND Object_ID = Object_ID(N'dbo.gates'))
BEGIN
    ALTER TABLE dbo.gates ADD gate_type VARCHAR(50);
END
GO

UPDATE dbo.gates SET gate_type = 'INOUT';
UPDATE dbo.gates SET gate_type = 'PATROL' WHERE gate_name LIKE '%Patrol%';
GO
