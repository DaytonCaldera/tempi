# 📦 TEMPI | Real-Time Inventory & Logistics

**TEMPI** is a high-performance, real-time inventory management ecosystem designed for fast-paced environments like events, warehouses, and department-based logistics. Built with **Next.js 15**, it balances administrative control with "on-the-ground" agility.

---

## 🚀 The Core Philosophy

Unlike traditional inventory systems that only track "current numbers," TEMPI is built on a **Double-Entry Audit System**. Every single change—no matter how small—is logged with a user ID, timestamp, and reason, ensuring total transparency and historical accountability.

### Key Features

* **⚡ Real-Time Synchronization**: Powered by SWR, stock levels update across all administrative and runner devices instantly without page refreshes.
* **📊 Advanced Consumption Reporting**: Generate granular reports by department or globally. See exactly what went "IN" and "OUT" within specific time windows.
* **🔍 Movement Drill-Down**: Click any item in a report to see a full log of every person who touched that stock, when they did it, and why.
* **🛡️ Role-Based Access (RBAC)**: Secure separation between **Superadmins**, **Admins**, and **Runners** (Field Users).
* **📱 Mobile-First "Runner" View**: Optimized for field staff to "burn" stock quickly using a 16px+ high-readability interface.
* **🏷️ Intelligent SKU Engine**: Automated, department-prefixed SKU generation (e.g., `LOG-4832`) to maintain a professional catalog.

---

## 🛠️ Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Database** | MongoDB (Aggregation Pipelines for Reporting) |
| **Auth** | NextAuth.js (Auth.js) |
| **Styling** | Tailwind CSS (Subtle & Dark Mode ready) |
| **Icons** | Lucide React |

---

## 📈 Data Architecture

TEMPI utilizes a **Denormalized Audit Pattern**. When a movement occurs, we capture the department and product metadata at that exact moment. This ensures that historical reports remain accurate even if products are renamed or departments are deleted in the future.

### Movement Log Structure
```json
{
  "inventoryId": "ObjectId",
  "departmentId": "ObjectId",
  "departmentName": "Main Kitchen",
  "productName": "Water Bottles 500ml",
  "type": "OUT",
  "amount": 24,
  "user": { "name": "John Doe", "email": "john@tempi.com" },
  "createdAt": "2026-04-06T15:00:00Z"
}
```

---

## 🌐 Languages

The UI ships in **Spanish (default)** and **English**, using [next-intl](https://next-intl.dev) without locale-prefixed routes.

* **Picking the locale**: the `NEXT_LOCALE` cookie (set by the language switcher) wins, then the browser's `Accept-Language`, then Spanish. See `i18n/config.ts` and `i18n/request.ts`.
* **Text**: every user-facing string, including API error messages, lives in `messages/es.json` and `messages/en.json`. Both files must have the same keys.
* **Dates**: formatted with next-intl in the `America/Costa_Rica` timezone.
* **Code**: identifiers, comments and logs are in English.
* **Stored values**: movement reasons (`MOVEMENT_REASONS`), units (`STOCK_UNITS`) and the default plan name are kept as they are stored in MongoDB; the UI translates them for display (`i18n/labels.ts`).
