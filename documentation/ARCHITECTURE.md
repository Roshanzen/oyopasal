# OyoPasal System Architecture Specification

## 1. Architectural Overview
OyoPasal is a hyperlocal multi-vendor marketplace platform operating on a modern decoupled architecture:
- **Frontend Presentation Layer:** React 19 + TypeScript + Vite (Port 3000)
- **Backend API Layer:** Python 3.12+ Django 5.x + Django REST Framework (Port 8000)
- **Primary Database:** MySQL 8.0 (InnoDB, UTF8MB4, Port 3306)
- **Object Relational Mapping (ORM):** Django ORM with native migrations

```text
    ┌────────────────────────────────────────────────────────┐
    │          React 19 + TypeScript + Vite UI               │
    │         (Components, Custom Hooks, Contexts)           │
    └───────────────────────────┬────────────────────────────┘
                                │ HTTP / REST (JSON)
                                │ JWT Bearer Auth
                                ▼
    ┌────────────────────────────────────────────────────────┐
    │             Django REST Framework API                  │
    │      (/api/v1/auth/, /api/v1/products/, etc.)          │
    │    - Serializers & ModelValidators                     │
    │    - Permissions (Customer, Seller, Admin)             │
    │    - Business Services & Atomic Transactions           │
    └───────────────────────────┬────────────────────────────┘
                                │ Django ORM
                                │ (mysqlclient / PyMySQL)
                                ▼
    ┌────────────────────────────────────────────────────────┐
    │                 MySQL 8.0 Database                     │
    │              (oyopasal_db - InnoDB)                    │
    │   - 68 Relational Tables (utf8mb4_unicode_ci)          │
    │   - Foreign Keys, Indexes, Cascades                    │
    └────────────────────────────────────────────────────────┘
```

---

## 2. Layer Responsibilities

### 2.1 Frontend Architecture (`src/`)
- **`src/config/`**: Runtime environment (`environment.ts`) and platform constants (`appConfig.ts`).
- **`src/services/`**: Modular API client (`HttpClient`) managing Bearer authentication headers, token refreshing, session isolation (`X-Session-Key`), and 14 domain-specific service modules.
- **`src/context/`**: Focused React contexts (`AuthContext`, `CartContext`, `WishlistContext`, `LocationContext`, `SellerContext`, `ThemeContext`, `ToastContext`, `LanguageContext`).
- **`src/hooks/`**: Custom hooks encapsulating data fetching and business workflows (`useAuth`, `useCart`, `useSeller`, `useCheckout`, etc.).
- **`src/pages/`**: Feature-level page components for customer marketplace, vendor portal, and administration.

### 2.2 Backend Architecture (`backend/`)
- **`backend/config/`**:
  - `settings/base.py`, `development.py`, `production.py`: Modular environment-driven settings.
  - `urls.py`: Canonical REST endpoint registry with OpenAPI 3 documentation (`/api/docs/`).
- **`backend/apps/`** (26 Domain Applications):
  - `accounts`: User identity, JWT authentication, roles, password validation.
  - `catalogue`: Categories, brands, products, variants, images, moderation.
  - `vendors` & `stores`: Merchant registration, business profiles, store configuration.
  - `cart` & `orders`: Customer carts, atomic order creation, vendor sub-order splitting.
  - `payments` & `settlements`: Nepal payment gateway integration (eSewa, Khalti, FonePay), financial ledger.
  - `delivery`: Delivery zones, fees, distance calculation, agent tracking.
  - `inventory`: Stock items, stock movements, and atomic stock reservations.
  - `promotions`, `reviews`, `notifications`, `support`, `audit`: Auxiliary marketplace services.

---

## 3. Database Architecture (`database/`)
- **Engine:** MySQL 8.0 with InnoDB storage engine for ACID transaction compliance.
- **Encoding:** `utf8mb4` with `utf8mb4_unicode_ci` collation ensuring full support for Nepali and special characters.
- **Integrity:** Native foreign key constraints, compound indexes on frequent queries, and transaction atomicity for multi-table writes.
- **Migration & Backup:** Django schema migrations (`manage.py migrate`), automated `mysqldump` PowerShell scripts, and cross-database JSON fixtures.
