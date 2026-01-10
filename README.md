# Component Tracker

Component Tracker is a local-first web application designed for managing
electronic components inventory in personal workshops and small labs.

The application focuses on simplicity, reliability, and full control over data.
All data is stored locally using SQLite, with no external cloud dependencies.

A simple file-based backup strategy can be applied by copying the database file,
making the system easy to maintain and restore without special tools.

---

## Features

- Full CRUD operations for components (Add / Edit / View / Delete)
- Category management with live updates
- Pagination with configurable limits
- Search and filtering
- Low-stock monitoring
- API-assisted component lookup (Element14, Mouser)
- Image preview support
- Datasheet links
- Internationalization (EN / SR) with live language switching
- Light / Dark theme toggle
- SQLite local database (file-based)
- No cloud services, no external database server

---

## Tech Stack

- Node.js
- Express.js
- EJS (server-side rendering)
- SQLite
- Bootstrap 5
- Vanilla JavaScript
- Custom i18n system

---

## Prerequisites

Before running this application, the following software must be installed
and properly configured on the system.

1. Node.js (v18 or newer)
   npm is included with Node.js.

   Download from:
   https://nodejs.org/

   Verify installation:

   node -v
   npm -v

   Both commands must return a version number.

2. A modern web browser
   (Chrome, Firefox, Edge, etc.)

No additional services or servers are required.

---

## Application Dependencies

All application dependencies are defined in the `package.json` file.

There are no setup or installation scripts.
Dependencies are installed using npm.

---

## Project Structure

component-tracker/
├── index.js                 Main application entry point
├── package.json
├── package-lock.json
├── apiServices/             External API integrations
├── views/
│   ├── layout.ejs           Global layout
│   ├── components/          Component views (list, details, edit)
│   ├── categories.ejs
│   ├── add-new.ejs
│   └── details.ejs
├── public/
│   ├── css/
│   ├── js/
│   └── i18n/                Translation files (EN / SR)
├── inventory.db             SQLite database (ignored by git)
├── version_info_mock.json
└── .gitignore

---

## Running the Application

After all prerequisites are installed:

1. Install dependencies:

   npm install

2. Start the application:

   node index.js

3. Open your browser and navigate to:

   http://localhost:3000

The SQLite database file (inventory.db) will be created automatically
on first run if it does not already exist.

---

## Database Notes

- SQLite is used as a local, file-based database.
- No database server installation is required.
- The database file is intentionally excluded from version control.
- Backups can be created by copying the database file.

---

## Internationalization (i18n)

- Custom-built i18n system
- Translation files located in public/i18n/
- Live language switching without page reload
- Easily extendable with additional languages

---

## Windows Convenience

On Windows systems, a start.bat file may be provided as a convenience.

It:
- starts the Node.js server
- opens the default browser at http://localhost:3000

Usage is optional.
The application can always be started manually using node index.js.

---

## Security and Deployment Notes

This application is intended for local use.

For remote access, it is recommended to:
- use a VPN (for example WireGuard)
- avoid exposing the application directly to the public internet

Authentication is not enforced by default.

---

## Project Status

- Stable
- Actively used
- Designed for local environments
- Not intended as a SaaS product

---

## License

Private project.
All rights reserved.
