-- Database schema for Apartment Management System

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('tenant', 'admin', 'maintenance_staff')),
  phone VARCHAR(20),
  avatar_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Apartment Units table
CREATE TABLE IF NOT EXISTS apartments (
  id SERIAL PRIMARY KEY,
  unit_number VARCHAR(50) UNIQUE NOT NULL,
  floor_number INTEGER,
  tenant_id INTEGER REFERENCES users(id),
  monthly_rent DECIMAL(10, 2),
  lease_start_date DATE,
  lease_end_date DATE,
  is_occupied BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rent Payments table
CREATE TABLE IF NOT EXISTS rent_payments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES users(id),
  apartment_id INTEGER REFERENCES apartments(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'PHP',
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue')),
  payment_method VARCHAR(50),
  payment_date DATE,
  paid_at TIMESTAMP,
  receipt_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Utility Readings table (for water, electricity, gas)
CREATE TABLE IF NOT EXISTS utility_readings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES users(id),
  apartment_id INTEGER REFERENCES apartments(id),
  utility_type VARCHAR(50) CHECK (utility_type IN ('water', 'electricity', 'gas')),
  reading_value DECIMAL(10, 2),
  reading_date DATE NOT NULL,
  unit VARCHAR(20),
  estimated_cost DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'PHP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Utility Forecasts table
CREATE TABLE IF NOT EXISTS utility_forecasts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES users(id),
  apartment_id INTEGER REFERENCES apartments(id),
  utility_type VARCHAR(50),
  forecasted_consumption DECIMAL(10, 2),
  forecasted_cost DECIMAL(10, 2),
  forecast_date DATE,
  confidence_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Anomaly Alerts table
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES users(id),
  utility_type VARCHAR(50),
  alert_type VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) CHECK (category IN ('plumbing', 'electrical', 'noise', 'maintenance', 'other')),
  priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_progress', 'resolved', 'closed')),
  assigned_to INTEGER REFERENCES users(id),
  resolution_notes TEXT,
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(255),
  message TEXT,
  notification_type VARCHAR(50),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(255),
  entity_type VARCHAR(100),
  entity_id INTEGER,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment History table
CREATE TABLE IF NOT EXISTS payment_history (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES users(id),
  rent_id INTEGER REFERENCES rent_payments(id),
  amount DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'PHP',
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ChatBot Conversations table
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT,
  response TEXT,
  intent VARCHAR(100),
  confidence_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_apartments_tenant_id ON apartments(tenant_id);
CREATE INDEX idx_rent_payments_tenant_id ON rent_payments(tenant_id);
CREATE INDEX idx_rent_payments_status ON rent_payments(status);
CREATE INDEX idx_utility_readings_tenant_id ON utility_readings(tenant_id);
CREATE INDEX idx_complaints_tenant_id ON complaints(tenant_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
