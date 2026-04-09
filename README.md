# JNL Apartment Management System

Comprehensive apartment management platform with tenant, admin, and maintenance workflows.

This README focuses on the latest implemented changes and current system behavior.

## Project Structure

- `frontend/` - React application (tenant/admin/maintenance UI)
- `backend/` - Node.js/Express API with SQLite
- `scripts/` - helper scripts (including local dev stack)

## Recent Major Changes

### 1) Chatbot Architecture Upgrade

- Consolidated chatbot flow into one production path in `backend/routes/chatbot.js`.
- Added response meta for frontend display:
  - `source` (feedback, smart-response, ollama, fallback)
  - `model` (e.g., `mistral:7b`, `rules+tenant-data`)
  - `translated` (boolean)
- Added Ollama integration (`backend/services/ollama-chatbot.js`) and set default model to `mistral:7b`.
- Improved routing logic between rule-based and LLM responses.

### 2) Smart Response Improvements

- Enhanced apartment-domain handling in `backend/services/smart-response.js`.
- Better rent/payment handling:
  - Outstanding detection
  - Due-date aware responses
  - Payment guidance flow
- Better utility responses:
  - Utility summaries
  - Baseline vs latest usage checks
  - High usage detection and alert phrasing
- Cleaner out-of-scope handling and friendlier casual response behavior.

### 3) Tenant Context for LLM

- Ollama now receives structured tenant context for apartment-related questions:
  - Rent/payment records summary
  - Recent utility readings
  - Complaint status records
  - Apartment metadata and rates context
- Casual/non-apartment chat uses lightweight prompting to avoid irrelevant tenant-data dumps.

### 4) Translation and Language Support

- `backend/services/translation.js` improved local phrase/word fallback coverage.
- Chatbot auto-detects message language and translates final response when needed.

### 5) Complaint AI Enhancements

- Sentiment analysis integrated during complaint submission (`backend/services/sentiment.js`).
- AI image recognition for maintenance flows in `backend/routes/complaint.js`:
  - Primary: Grounding DINO
  - Fallback: DETR
  - Final fallback: local heuristic detections with practical hints
- Attachment handling and upload support improved.

### 6) Payment and Currency Conversion

- Realtime exchange service in `backend/services/exchange.js` with:
  - Live rate fetch (Frankfurter)
  - Cache and fallback behavior
- Conversion integrated into payment flow (`backend/routes/payment.js`):
  - Original and converted amounts stored
  - Conversion metadata persisted for audit/tracking
- Conversion endpoints available (`/api/payment/convert`, `/api/payment/test-convert`).

### 7) Frontend Chatbot UX Updates

- Message metadata label below bot replies (source/model).
- Scroll/backread behavior fixed in `frontend/src/components/Chatbot.js`.
- Quick question startup spacing/layout improvements.

### 8) New/Expanded Feature Areas

- Chat history support (`backend/services/chat-history.js`).
- Predictive suggestions service (`backend/services/predictive-suggestions.js`).
- Meralco rates integration (`backend/services/meralco-rates.js`).
- Additional appointment/notification/profile pages and supporting components in frontend.

## AI Components Summary

System footprint currently tracks 14 AI components/features, including:

- Ollama local LLM generation
- Smart response rule engine
- Feedback memory matching
- Language detection + translation
- Predictive suggestion logic
- Utility analytics + high-usage detection
- Sentiment analysis for complaints
- Vision detection stack (Grounding DINO, DETR, local fallback)
- Orchestration/routing logic
- Legacy enhanced chatbot service (retained)

## Exchange Rate Accuracy Note

Recent validation confirmed API conversion output aligns with live provider rates for tested pairs (e.g., PHP/USD, USD/PHP, EUR/USD) at test time.

## Environment and Runtime

### Backend

- Node.js + Express
- SQLite database
- Run from `backend/`

### Frontend

- React app
- Run from `frontend/`

### Ollama

- Local Ollama required for LLM path
- Default model: `mistral:7b`

## Typical Local Run

1. Start backend

```bash
cd backend
npm install
npm start
```

2. Start frontend

```bash
cd frontend
npm install
npm start
```

3. Ensure Ollama model is available

```bash
ollama list
ollama pull mistral:7b
```

## API Highlights

- Chat query: `POST /api/chatbot/query`
- Chat suggestions: `GET /api/chatbot/suggestions`
- Chat history: `GET /api/chatbot/history`
- Tenant overview: `GET /api/chatbot/tenant-overview`
- Payment conversion: `GET /api/payment/convert`
- Complaint AI recognition: `POST /api/complaint/ai/recognize`

## Notes

- Legacy docs were consolidated into `ALL_RECENT_UPDATES.txt`.
- This README is a concise operational snapshot of latest behavior and architecture.
