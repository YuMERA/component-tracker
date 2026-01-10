# Component Tracker

Component Tracker is a local-first web application for managing electronic components inventory.
It is designed for personal workshops and small labs where simplicity, speed, and reliability
are more important than cloud complexity.

The application runs locally, uses SQLite for storage, and provides a clean UI with advanced
filtering, pagination, and category management.

---

## ✨ Features

- Full CRUD for components (Add / Edit / View / Delete)
- Component categories with live management
- Pagination with configurable limits
- Search and filters
- Low-stock monitoring
- API-assisted component lookup (Element14 / Mouser)
- Image preview for components
- Datasheet links
- Internationalization (EN / SR) with live language switching
- Light / Dark theme toggle
- SQLite database (local, file-based)
- No external cloud dependencies

---

## 🧰 Tech Stack

- **Node.js**
- **Express.js**
- **EJS** (server-side rendering)
- **SQLite** (local database)
- **Bootstrap 5**
- **Vanilla JavaScript**
- **Custom i18n system**

---

## 📁 Project Structure

component-tracker/
├── index.js # Main application entry point
├── package.json
├── package-lock.json
├── apiServices/ # External API integrations (Element14, Mouser, etc.)
├── views/
│ ├── layout.ejs # Global layout
│ ├── components/ # Components views (list, details, edit)
│ ├── categories.ejs
│ ├── add-new.ejs
│ └── details.ejs
├── public/
│ ├── css/
│ ├── js/
│ └── i18n/ # Translation files (EN / SR)
├── inventory.db # SQLite database (ignored by git)
├── version_info_mock.json
└── .gitignore

yaml
Copy code

> ⚠️ **Note:**  
> `inventory.db` is intentionally excluded from the repository.
> Each installation creates and maintains its own local database.

---

## ⚙️ Requirements

- **Node.js** (v18 or newer recommended)
- **npm**
- Windows, Linux, or macOS

---

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/YuMERA/component-tracker.git
cd component-tracker
Install dependencies:

bash
Copy code
npm install
▶️ Running the Application
Start the server:

bash
Copy code
node index.js
Then open your browser at:

arduino
Copy code
http://localhost:3000
The SQLite database file will be created automatically if it does not exist.

🗄 Database Notes
SQLite is used for simplicity and portability

Database file is local (inventory.db)

Not tracked by Git

Backup strategy can be implemented via file copy

🌍 Internationalization (i18n)
Custom-built i18n system

Language files located in:

swift
Copy code
public/i18n/
Live language switching without page reload

Easily extendable with new languages

🔐 Security & Deployment Notes
This application is intended for local use.

If remote access is required, it is recommended to:

Use a VPN (e.g. WireGuard)

Avoid exposing the application directly to the public internet

Authentication is intentionally not enforced by default.

📌 Project Status
Stable

Actively used

Designed for local environments

Not intended as a SaaS product

📝 License
Private project.
All rights reserved.