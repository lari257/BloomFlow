# BloomFlow Frontend

React-based frontend application for the BloomFlow flower shop management system.

## Features

- **Authentication**: Custom login form with Keycloak integration
- **Dashboard**: Role-based overview with statistics and recent orders
- **Inventory Management**: Manage flowers and lots (admin/florar only)
- **Order Management**: Create, view, and manage orders
- **Bouquet Builder**: Generate custom bouquet configurations based on budget and preferences
- **User Profile**: View user information and roles

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the `frontend` directory with:
```
VITE_KEYCLOAK_CLIENT_SECRET=your_client_secret_here
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Configuration

Update API endpoints in `src/utils/constants.js` if your backend services are running on different ports.

## Backend Services

Make sure the following services are running:
- Auth Service: http://localhost:5001
- User Service: http://localhost:5002
- Inventory Service: http://localhost:5003
- Order Service: http://localhost:5004
- Bouquet Service: http://localhost:5005
- Keycloak: http://localhost:8080

