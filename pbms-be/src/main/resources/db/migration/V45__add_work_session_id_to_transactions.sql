ALTER TABLE transactions ADD work_session_id BIGINT;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_work_session FOREIGN KEY (work_session_id) REFERENCES staff_work_sessions(id);
