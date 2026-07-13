SET NAMES utf8mb4;
SET time_zone = 'SYSTEM';

ALTER TABLE appointments
  ADD UNIQUE KEY uq_appointments_id_pet (id, pet_id),
  ADD UNIQUE KEY uq_appointments_id_customer (id, customer_id);

ALTER TABLE medical_notes
  DROP FOREIGN KEY fk_medical_notes_appointment,
  DROP INDEX idx_medical_notes_appointment,
  ADD KEY idx_medical_notes_appointment_pet (appointment_id, pet_id),
  ADD CONSTRAINT fk_medical_notes_appointment_pet
    FOREIGN KEY (appointment_id, pet_id) REFERENCES appointments(id, pet_id)
    ON DELETE RESTRICT;

ALTER TABLE payments
  DROP FOREIGN KEY fk_payments_appointment,
  DROP INDEX idx_payments_appointment,
  ADD KEY idx_payments_appointment_customer (appointment_id, customer_id),
  ADD CONSTRAINT fk_payments_appointment_customer
    FOREIGN KEY (appointment_id, customer_id) REFERENCES appointments(id, customer_id)
    ON DELETE RESTRICT;

ALTER TABLE reminders
  DROP FOREIGN KEY fk_reminders_pet,
  DROP INDEX idx_reminders_pet,
  ADD KEY idx_reminders_pet_customer (pet_id, customer_id),
  ADD CONSTRAINT fk_reminders_pet_customer
    FOREIGN KEY (pet_id, customer_id) REFERENCES pets(id, customer_id)
    ON DELETE RESTRICT;
