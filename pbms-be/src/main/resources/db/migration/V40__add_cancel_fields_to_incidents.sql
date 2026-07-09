-- Add cancel_type column to incident_tickets table
ALTER TABLE incident_tickets 
ADD cancel_type VARCHAR(50);
