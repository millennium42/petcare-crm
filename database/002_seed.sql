SET NAMES utf8mb4;
SET time_zone = 'SYSTEM';

INSERT INTO customers (id, name, email, phone, address, notes) VALUES
  (1, 'Marina Oliveira', 'marina@example.test', '(11) 99911-2233', 'Rua das Flores, 120', 'Prefere contato por WhatsApp.'),
  (2, 'Rafael Santos', 'rafael@example.test', '(11) 98877-6655', 'Av. Central, 450', 'Cliente do hotel em feriados.')
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), address = VALUES(address), notes = VALUES(notes);

-- bcrypt, custo 12, senha local de demonstração: Demo123!
INSERT INTO users (id, name, email, password_hash, role, customer_id) VALUES
  (1, 'Ana Administradora', 'admin@petcare.local', '$2b$12$mhgTUyir1GDTb08KU5CME.OvDfFFFctxzFMcD57LO.yR6lqU/UMLK', 'admin', NULL),
  (2, 'Bruno da Equipe', 'equipe@petcare.local', '$2b$12$mhgTUyir1GDTb08KU5CME.OvDfFFFctxzFMcD57LO.yR6lqU/UMLK', 'equipe', NULL),
  (3, 'Marina Oliveira', 'cliente@petcare.local', '$2b$12$mhgTUyir1GDTb08KU5CME.OvDfFFFctxzFMcD57LO.yR6lqU/UMLK', 'cliente', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role), customer_id = VALUES(customer_id);

INSERT INTO pets (id, customer_id, name, species, breed, sex, birth_date, weight_kg, allergies, notes) VALUES
  (1, 1, 'Luna', 'Cão', 'Golden Retriever', 'femea', '2021-03-18', 27.40, 'Sensibilidade a frango', 'Muito dócil durante consultas.'),
  (2, 1, 'Nino', 'Gato', 'SRD', 'macho', '2022-08-10', 5.20, NULL, 'Gosta de caixa de transporte coberta.'),
  (3, 2, 'Thor', 'Cão', 'Bulldog Francês', 'macho', '2020-11-02', 13.10, 'Dermatite sazonal', 'Acompanhar respiração em dias quentes.')
ON DUPLICATE KEY UPDATE customer_id = VALUES(customer_id), name = VALUES(name), weight_kg = VALUES(weight_kg), allergies = VALUES(allergies), notes = VALUES(notes);

INSERT INTO vaccines (id, pet_id, name, dose, application_date, next_due_date, veterinarian, status) VALUES
  (1, 1, 'V10', 'Reforço anual', '2025-08-20', '2026-08-20', 'Dra. Camila Lima', 'pendente'),
  (2, 2, 'Antirrábica', 'Dose anual', '2026-02-12', '2027-02-12', 'Dra. Camila Lima', 'aplicada'),
  (3, 3, 'Gripe canina', 'Intranasal', '2025-06-30', '2026-06-30', 'Dr. Paulo Reis', 'atrasada')
ON DUPLICATE KEY UPDATE next_due_date = VALUES(next_due_date), status = VALUES(status);

INSERT INTO appointments (id, customer_id, pet_id, service_type, scheduled_at, status, notes) VALUES
  (1, 1, 1, 'consulta', TIMESTAMP(CURRENT_DATE, '09:30:00'), 'confirmado', 'Retorno dermatológico.'),
  (2, 1, 2, 'banho', DATE_ADD(NOW(), INTERVAL 2 DAY), 'agendado', 'Usar shampoo neutro.'),
  (3, 2, 3, 'exame', DATE_ADD(NOW(), INTERVAL 5 DAY), 'agendado', 'Hemograma de controle.')
ON DUPLICATE KEY UPDATE scheduled_at = VALUES(scheduled_at), status = VALUES(status), notes = VALUES(notes);

INSERT INTO services (id, customer_id, pet_id, type, service_date, status, value_cents, notes) VALUES
  (1, 1, 1, 'consulta', DATE_SUB(NOW(), INTERVAL 20 DAY), 'concluido', 18000, 'Avaliação clínica geral.'),
  (2, 1, 1, 'banho', DATE_SUB(NOW(), INTERVAL 12 DAY), 'concluido', 8500, 'Hidratação de pelagem.'),
  (3, 1, 2, 'tosa', DATE_SUB(NOW(), INTERVAL 35 DAY), 'concluido', 7000, 'Tosa higiênica.'),
  (4, 2, 3, 'exame', DATE_SUB(NOW(), INTERVAL 60 DAY), 'concluido', 22000, 'Hemograma e bioquímico.'),
  (5, 2, 3, 'hotel', DATE_SUB(NOW(), INTERVAL 90 DAY), 'concluido', 36000, 'Três diárias.'),
  (6, 1, 1, 'procedimento', DATE_SUB(NOW(), INTERVAL 120 DAY), 'concluido', 45000, 'Limpeza dentária simples.')
ON DUPLICATE KEY UPDATE service_date = VALUES(service_date), status = VALUES(status), value_cents = VALUES(value_cents), notes = VALUES(notes);

INSERT INTO medical_notes (id, pet_id, appointment_id, author_user_id, observation) VALUES
  (1, 1, 1, 2, 'Paciente alerta, hidratada e com melhora da irritação cutânea. Manter acompanhamento.'),
  (2, 3, 3, 2, 'Histórico de dermatite sazonal; coletar exames antes de alterar medicação.')
ON DUPLICATE KEY UPDATE observation = VALUES(observation), author_user_id = VALUES(author_user_id);

INSERT INTO payments (id, customer_id, appointment_id, description, amount_cents, method, status, due_date, paid_date) VALUES
  (1, 1, 1, 'Consulta dermatológica', 18000, 'pix', 'pago', DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY), DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY)),
  (2, 1, 2, 'Banho agendado', 8500, 'cartao', 'pendente', DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY), NULL),
  (3, 2, 3, 'Exames laboratoriais', 22000, 'boleto', 'atrasado', DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status), due_date = VALUES(due_date), paid_date = VALUES(paid_date);

INSERT INTO reminders (id, customer_id, pet_id, kind, message, due_at, status) VALUES
  (1, 1, 1, 'vacina', 'A vacina V10 da Luna vence em breve.', DATE_ADD(NOW(), INTERVAL 3 DAY), 'pendente'),
  (2, 1, 2, 'agendamento', 'Banho do Nino confirmado para esta semana.', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pendente'),
  (3, 2, 3, 'pagamento', 'Pagamento dos exames do Thor está em aberto.', DATE_ADD(NOW(), INTERVAL 6 HOUR), 'pendente'),
  (4, 2, 3, 'retorno', 'Agendar retorno após o resultado do hemograma.', DATE_ADD(NOW(), INTERVAL 7 DAY), 'pendente')
ON DUPLICATE KEY UPDATE due_at = VALUES(due_at), status = VALUES(status), message = VALUES(message);
