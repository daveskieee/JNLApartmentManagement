-- Migration: Create chatbot_feedback table
CREATE TABLE IF NOT EXISTS chatbot_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  message TEXT,
  response TEXT,
  helpful INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
