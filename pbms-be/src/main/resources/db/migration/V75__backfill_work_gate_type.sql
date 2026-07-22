-- V75: Backfill work_gate_type in staff_work_sessions
UPDATE dbo.staff_work_sessions
SET work_gate_type = 'IN_OUT'
WHERE work_gate_type IS NULL;
