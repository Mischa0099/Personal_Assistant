# AI Personal Coach

This project contains:
- A Flask backend API in backend/
- A React frontend in frontend/app/

## Deployment options

### Option 1: Render (recommended)
1. Create two services on Render:
   - Web Service for the backend from backend/
   - Static Site for the frontend from frontend/app/
2. Set backend environment variables:
   - PORT=10000
   - SECRET_KEY=your-secret-key
   - FRONTEND_URL=https://your-frontend-url
3. Set frontend environment variable:
   - REACT_APP_API_URL=https://your-backend-url

### Option 2: Railway
1. Create a new Railway project.
2. Deploy the backend from backend/ using the Procfile.
3. Deploy the frontend from frontend/app/ as a React app.

## Local development
- Backend: python backend/app.py
- Frontend: cd frontend/app && npm start
