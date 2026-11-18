# OyoPasal – REST API Documentation

**Base URL:** `http://127.0.0.1:8000/api/v1`  
**Interactive Swagger UI:** `http://127.0.0.1:8000/api/docs/`  
**OpenAPI ReDoc:** `http://127.0.0.1:8000/api/redoc/`  
**OpenAPI 3.0 Schema:** `http://127.0.0.1:8000/api/schema/`  

---

## 1. Authentication (`/api/v1/auth/`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register/` | Register new customer account | No |
| `POST` | `/api/v1/auth/login/` | Authenticate using phone/email + password | No |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh JWT access token using refresh token | No |
| `POST` | `/api/v1/auth/logout/` | Blacklist refresh token & logout session | Bearer |
| `GET` | `/api/v1/auth/profile/` | Fetch authenticated user profile | Bearer |
| `POST` | `/api/v1/auth/seller/login/` | Authenticate merchant with vendor credentials | No |

---

## 2. Product Catalog (`/api/v1/`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/products/` | Paginated product list with search, filter, sort | No |
| `GET` | `/api/v1/products/<slug_or_id>/` | Detailed product info with variants & images | No |
| `GET` | `/api/v1/categories/` | All active categories and parent-child hierarchy | No |
| `GET` | `/api/v1/categories/<slug>/` | Products within specific category | No |
| `GET` | `/api/v1/zones/` | Active delivery zones and delivery fee rules | No |

---

## 3. Shopping Cart (`/api/v1/cart/`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/cart/` | Fetch current active cart (User or Session) | Optional |
| `POST` | `/api/v1/cart/items/` | Add product/variant to cart | Optional |
| `PATCH`| `/api/v1/cart/items/<id>/` | Update item quantity | Optional |
| `DELETE`| `/api/v1/cart/items/<id>/`| Remove item from cart | Optional |
| `POST` | `/api/v1/cart/clear/` | Empty active cart | Optional |
| `POST` | `/api/v1/checkout/validate/` | Validate stock, price, delivery before checkout | Optional |

---

## 4. Orders & Checkout (`/api/v1/orders/`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/orders/` | Create order from cart with address & payment | Bearer |
| `GET` | `/api/v1/orders/` | List customer order history | Bearer |
| `GET` | `/api/v1/orders/<order_id>/` | Detailed order summary with sub-orders | Bearer |
| `POST` | `/api/v1/orders/<order_id>/cancel/` | Cancel pending order | Bearer |

---

## 5. Merchant & Vendor Portal (`/api/v1/seller/` & `/api/v1/vendors/`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/vendors/register/` | Onboard new seller & business profile | No / Bearer |
| `GET` | `/api/v1/seller/dashboard/` | Merchant metrics, revenue, low stock count | Bearer (Seller) |
| `GET` | `/api/v1/seller/store/` | Get merchant store details | Bearer (Seller) |
| `PATCH`| `/api/v1/seller/store/` | Update merchant store details | Bearer (Seller) |
| `GET` | `/api/v1/seller/products/` | List products owned by this seller | Bearer (Seller) |
| `POST` | `/api/v1/seller/products/` | Create new product listing | Bearer (Seller) |
| `GET` | `/api/v1/seller/orders/` | List vendor sub-orders for fulfillment | Bearer (Seller) |
| `PATCH`| `/api/v1/seller/orders/<id>/status/` | Update fulfillment status (ready/dispatched) | Bearer (Seller) |
