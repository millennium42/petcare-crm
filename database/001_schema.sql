SET NAMES utf8mb4;
SET time_zone = 'SYSTEM';

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address VARCHAR(255) NULL,
  notes TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_email (email),
  KEY idx_customers_active_name (active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin', 'equipe', 'cliente') NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_customer (customer_id),
  CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT chk_client_customer CHECK (role <> 'cliente' OR customer_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  species VARCHAR(80) NOT NULL,
  breed VARCHAR(100) NULL,
  sex ENUM('macho', 'femea', 'desconhecido') NOT NULL DEFAULT 'desconhecido',
  birth_date DATE NULL,
  weight_kg DECIMAL(6,2) NULL,
  allergies TEXT NULL,
  notes TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pets_customer_name (customer_id, name),
  UNIQUE KEY uq_pets_id_customer (id, customer_id),
  CONSTRAINT fk_pets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT chk_pets_weight CHECK (weight_kg IS NULL OR weight_kg > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS vaccines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pet_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  dose VARCHAR(80) NULL,
  application_date DATE NOT NULL,
  next_due_date DATE NULL,
  veterinarian VARCHAR(120) NULL,
  status ENUM('aplicada', 'pendente', 'atrasada') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_vaccines_pet_date (pet_id, application_date),
  KEY idx_vaccines_due_status (next_due_date, status),
  CONSTRAINT fk_vaccines_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  pet_id BIGINT UNSIGNED NOT NULL,
  type ENUM('consulta', 'banho', 'tosa', 'exame', 'hotel', 'procedimento') NOT NULL,
  service_date DATETIME NOT NULL,
  status ENUM('agendado', 'em_andamento', 'concluido', 'cancelado') NOT NULL,
  value_cents INT UNSIGNED NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_services_customer_date (customer_id, service_date),
  KEY idx_services_pet_date (pet_id, service_date),
  CONSTRAINT fk_services_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_services_pet_owner FOREIGN KEY (pet_id, customer_id) REFERENCES pets(id, customer_id) ON DELETE CASCADE,
  CONSTRAINT chk_services_value CHECK (value_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  pet_id BIGINT UNSIGNED NOT NULL,
  service_type ENUM('consulta', 'banho', 'tosa', 'exame', 'hotel', 'procedimento') NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status ENUM('agendado', 'confirmado', 'concluido', 'cancelado') NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_appointments_customer_date (customer_id, scheduled_at),
  KEY idx_appointments_pet_date (pet_id, scheduled_at),
  KEY idx_appointments_status_date (status, scheduled_at),
  CONSTRAINT fk_appointments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_appointments_pet_owner FOREIGN KEY (pet_id, customer_id) REFERENCES pets(id, customer_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS medical_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pet_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  author_user_id BIGINT UNSIGNED NULL,
  observation TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medical_notes_pet_created (pet_id, created_at),
  KEY idx_medical_notes_appointment (appointment_id),
  KEY idx_medical_notes_author (author_user_id),
  CONSTRAINT fk_medical_notes_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  CONSTRAINT fk_medical_notes_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT fk_medical_notes_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  method ENUM('dinheiro', 'pix', 'cartao', 'boleto', 'outro') NOT NULL,
  status ENUM('pendente', 'pago', 'atrasado', 'cancelado') NOT NULL,
  due_date DATE NULL,
  paid_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_customer_due (customer_id, due_date),
  KEY idx_payments_status_due (status, due_date),
  KEY idx_payments_appointment (appointment_id),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reminders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  pet_id BIGINT UNSIGNED NULL,
  kind ENUM('vacina', 'agendamento', 'pagamento', 'retorno', 'outro') NOT NULL,
  message VARCHAR(1000) NOT NULL,
  due_at DATETIME NOT NULL,
  status ENUM('pendente', 'enviado', 'concluido', 'cancelado') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reminders_customer_due (customer_id, due_at),
  KEY idx_reminders_status_due (status, due_at),
  KEY idx_reminders_pet (pet_id),
  CONSTRAINT fk_reminders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
