# KaosSub - Data Subscription Platform

A complete data subscription platform for Nigerian networks with Paystack payment integration.

## 🌟 Features

### User Features
- **User Registration & Authentication** - Secure signup and login system
- **Wallet System** - Integrated with Paystack for seamless payments
- **Data Plans** - Comprehensive plans for all Nigerian networks (MTN, Airtel, Glo, 9mobile)
- **Real-time Transaction Tracking** - Monitor your data purchases and transactions
- **Profile Management** - Update personal information and preferences
- **Transaction History** - View complete purchase history

### Admin Features
- **Admin Dashboard** - Manage users, transactions, and platform settings
- **User Management** - View and manage user accounts
- **Transaction Monitoring** - Track all platform transactions
- **System Analytics** - Platform performance and usage statistics

### Technical Features
- **Responsive Design** - Works perfectly on desktop and mobile devices
- **Secure Authentication** - JWT-based authentication system
- **RESTful API** - Clean and well-structured backend API
- **Payment Integration** - Paystack payment gateway for secure transactions
- **Real-time Notifications** - Email and in-app notifications

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Supabase database
- Paystack account

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/KAOS-CODM/KaosSub.git
cd KaosSub-Clean
```

1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure your environment variables in .env
npm start
```

1. Frontend Setup

```bash
cd frontend
# Open index.html in your browser or serve with a local server
```

Environment Configuration

Create a .env file in the backend directory with:

```env
DATABASE_URL=your_mysql_connection_string
PAYSTACK_SECRET_KEY=your_paystack_secret_key
JWT_SECRET=your_jwt_secret
EMAIL_SERVICE_CONFIG=your_email_config
```

📁 Project Structure

```
KaosSub-Clean/
├── 📁 BACKEND/
│   ├── 📁 config/          # Database and service configurations
│   ├── 📁 controllers/     # Route controllers
│   ├── 📁 middleware/      # Authentication and validation
│   ├── 📁 routes/          # API routes
│   ├── 📁 services/        # Business logic and external services
│   ├── 📁 utils/           # Helper functions and utilities
│   └── server.js          # Main server file
│
├── 📁 FRONTEND/
│   ├── 📁 css/            # Stylesheets
│   ├── 📁 js/             # JavaScript modules
│   │   ├── 📁 components/ # Reusable components
│   │   └── *.js           # Feature-specific scripts
│   ├── 📁 assets/         # Images, icons, and static files
│   └── *.html             # Application pages
│
├── 📄 SCHEMA.sql          # Database schema
├── 📄 .gitignore          # Git ignore rules
└── 📄 README.md           # Project documentation
```

## 🛠️ Technology Stack

### Backend

- Node.js - Runtime environment
- Express.js - Web framework
- JWT - Authentication
- MySQL - Database
- Paystack API - Payment processing

### Frontend

- HTML5 - Markup
- CSS3 - Styling
- Vanilla JavaScript - Client-side functionality
- Responsive Design - Mobile-first approach

### 🔧 API Endpoints

#### Authentication

- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout

#### Data Services

- GET /api/data/plans - Get available data plans
- POST /api/data/purchase - Purchase data plan
- GET /api/data/history - Get purchase history

#### Wallet & Payments

- GET /api/wallet/balance - Get wallet balance
- POST /api/wallet/fund - Fund wallet via Paystack
- POST /api/webhook/paystack - Paystack webhook

### 🤝 Contributing

1. Fork the repository
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

### 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

###  📞 Support

#### For support and queries:

- Create an issue on GitHub
- Contact the development team

### 🔗 Links

- Live Demo
- API Documentation
- Frontend Repository
- Backend Repository

---

KaosSub - Making data subscriptions simple and accessible. 📱✨
