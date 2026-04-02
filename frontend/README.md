# Apartment Management System - Frontend

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the frontend directory:
```
REACT_APP_API_URL=http://localhost:5000
```

### 3. Start the Application
```bash
npm start
```

The application will open at `http://localhost:3000`

## Project Structure

- `src/pages/` - Page components (Login, Register, Dashboards)
- `src/components/` - Reusable components
- `src/context/` - React Context for state management
- `src/services/` - API service calls
- `src/hooks/` - Custom React hooks
- `src/utils/` - Utility functions
- `public/` - Static assets

## Features

### 1. Authentication
- Login/Register with role-based access
- JWT token management
- Private route protection

### 2. Tenant Features
- Dashboard with overview
- Rent payment tracking
- Utility consumption history
- Complaint submission and tracking
- Chatbot support

### 3. Admin Features
- Overview dashboard with statistics
- Tenant management
- Rent collection tracking
- Complaint management
- Reports and analytics

### 4. Maintenance Staff Features
- Task assignment and management
- Complaint tracking
- Work completion logging

## Dependencies

- React 18.2.0
- React Router DOM 6.10.0
- Axios for API calls
- Recharts for data visualization
- React Hot Toast for notifications
- Tailwind CSS for styling
- React Icons for UI icons

## API Integration

All API calls are made through Axios with JWT token authentication. The API base URL is configured via environment variables.
