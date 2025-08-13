# Project Blueprint: User Management Dashboard

This document outlines the architecture, features, and setup of the application.

## 1. Project Goal

A simple, brandable web dashboard to manage users and their mailboxes within a specific group on a host server.

## 2. Technology Stack

*   **Backend Runtime:** Deno
*   **Web Framework:** Hono
*   **Language:** TypeScript
*   **Frontend:** Vanilla JavaScript and CSS
*   **Data Persistence:** Deno KV (for audit logs)

## 3. Core Features

*   **Authentication:** Secure access is provided via HTTP Basic Authentication.
*   **Modal-based UI:** User and mailbox creation is handled through a clean, tabbed popup modal.
*   **Separated User and Mailbox Management:** The UI is divided into distinct sections for managing users and mailboxes.
*   **User Management:**
    *   List all users within a specified group.
    *   Create a new user via a modal popup.
    *   Optionally create a default or custom-named mailbox for the new user upon creation.
    *   Delete a user.
    *   Disable or re-enable a user's login access.
    *   Generate a one-time password reset link.
*   **Mailbox Management:**
    *   List all mailboxes for the configured domains, hiding those of excluded users.
    *   Create a new, standalone mailbox and assign it to any user in the managed group.
    *   Delete a mailbox.
    *   Real-time validation to check if a mailbox name is already in use.
*   **Input Validation:** Username and mailbox name inputs are strictly validated in the UI to only allow lowercase letters and numbers.
*   **User Exclusion:** An environment variable (`EXCLUDE_ACCOUNTS`) allows specific usernames and their mailboxes to be hidden from the UI.
*   **Secure Audit Logging:**
    *   All major actions are logged to a persistent Deno KV store.
    *   Access to the audit log UI is protected by a separate key (`AUDIT_KEY`).
    *   The log viewer is opened by clicking the word "Server" in the footer and entering the key when prompted.
    *   The audit log viewer has an improved, professional design.
*   **File Logging:** All application events are logged to `app.log`.
*   **Customization:**
    *   The email domains available in the UI are configurable.
    *   The application title can be customized with a branding name.
    *   A dynamic copyright footer is included.

## 4. Host Server API Endpoints Used

*   **Users:** `GET /users`, `POST /users`, `DELETE /users/{id}`, `PUT /users/{id}/active`, `GET /users/{id}/password_reset_link`
*   **Groups:** `GET /groups`, `GET /groups/{id}`, `PUT /groups/{id}/members`
*   **Mail:** `GET /mail/{domain}/status`, `POST /mail/{domain}/mailboxes`, `DELETE /mail/{domain}/mailboxes/{name}`, `GET /mail/{domain}/mailboxes/{name}`, `GET /mail/{domain}/mailboxes`

## 5. Environment Variables

*   `CLOUDRON_API_URL`: The base URL of the host server.
*   `CLOUDRON_API_TOKEN`: An API token with sufficient permissions.
*   `CLOUDRON_GROUP_NAME`: The name of the group to manage.
*   `DASHBOARD_USERNAME`: The username for Basic Auth.
*   `DASHBOARD_PASSWORD`: The password for Basic Auth.
*   `MAIL_DOMAINS`: A comma-separated list of domain names for creating mailboxes.
*   `BRAND_NAME`: (Optional) A name to display in the UI header.
*   `EXCLUDE_ACCOUNTS`: (Optional) A comma-separated list of usernames to hide from the UI.
*   `AUDIT_KEY`: (Optional) A secret key required to view the audit logs.
*   `APP_ENV`: Set to `production` in a production environment.

## 6. Architecture and Data Flow

The application is designed with a clear separation between the frontend (client-side) and the backend (server-side). The backend acts as a secure proxy that communicates with the Cloudron API.

### Frontend (Client-Side)

*   **Location:** `/static` directory
*   **Files:** `index.html`, `style.css`, `script.js`
*   **Framework:** None (Vanilla JavaScript)

**Flow:**

1.  **Initial Load:** When a user navigates to the application's URL, the server sends the `index.html` file.
2.  **Asset Loading:** The browser parses `index.html` and requests the linked `style.css` and `script.js` files.
3.  **Initialization (`DOMContentLoaded`):** Once the page is loaded, `script.js` executes.
4.  **API Helper:** A helper function `api(path, options)` is defined to simplify making `fetch` requests to the backend. It automatically adds the `/api` prefix and handles JSON parsing.
5.  **Initial Data Fetch (`fetchAndDisplayData`):**
    *   This core function is called immediately on startup.
    *   It uses `Promise.all` to make three parallel requests to the backend:
        *   `GET /api/users`
        *   `GET /api/mailboxes`
        *   `GET /api/config`
6.  **Rendering:**
    *   Upon receiving successful responses, the script calls render functions (`renderUsers`, `renderMailboxes`, `renderSelects`).
    *   These functions dynamically generate HTML table rows and select options from the fetched JSON data and inject them into the DOM.
7.  **User Interaction:**
    *   Event listeners are attached to buttons (`Add New`, `Delete`, `Reset Password`, etc.) and forms.
    *   When a user performs an action (e.g., clicks "Delete User"), the corresponding event listener fires.
    *   The listener calls the `api()` helper to make a request to the appropriate backend endpoint (e.g., `DELETE /api/users/:id`).
    *   After the backend confirms the action, `fetchAndDisplayData()` is called again to refresh the UI with the latest data.

### Backend (Server-Side)

*   **Runtime:** Deno
*   **Framework:** Hono
*   **Entry Point:** `main.ts`

**Flow:**

1.  **Startup:** The `start.sh` script executes `deno run main.ts`.
2.  **Environment Loading:** The `start.sh` script is responsible for loading the `.env` file into the environment.
3.  **Server Initialization (`main.ts`):**
    *   A new Hono application instance is created.
    *   Middleware is registered to log every incoming request.
4.  **API Routing:**
    *   A main router is created for the `/api` path.
    *   **Authentication:** All routes under `/api` are protected by the `basicAuthMiddleware` from `api/auth.ts`. This middleware checks the `Authorization` header of every API request before it proceeds.
    *   The API router then delegates to smaller, feature-specific "sub-apps":
        *   `/api/users` -> `usersApp` (`api/users.ts`)
        *   `/api/mailboxes` -> `mailboxesApp` (`api/mailboxes.ts`)
        *   `/api/config` -> `configApp` (`api/config.ts`)
        *   And so on.
5.  **Static File Serving:** A catch-all route `app.get("/*", ...)` is defined. If a request does not match any API routes, the server attempts to serve a file from the `./static` directory. This is how the frontend is delivered.
6.  **Service Layer (`services/cloudron.ts`):**
    *   This is the **only** part of the application that communicates directly with the Cloudron API.
    *   It reads the `CLOUDRON_API_URL` and `CLOUDRON_API_TOKEN` from the environment variables.
    *   It exports a set of functions, each corresponding to a specific Cloudron API action (e.g., `getUsers`, `createMailbox`).
    *   The core of this file is the `cloudronFetch` helper function, which takes a path and options, constructs the full Cloudron API URL, and attaches the `Authorization: Bearer <API_TOKEN>` header to every request.
7.  **Request Handling Example (`GET /api/users`):**
    *   A request hits the server.
    *   The `basicAuthMiddleware` validates the credentials.
    *   The request is routed to the `usersApp`.
    *   The `GET "/"` handler in `api/users.ts` is executed.
    *   It calls `cloudron.getUsers()` and `cloudron.getGroupDetails()` from the service layer.
    *   `services/cloudron.ts` makes the actual `fetch` calls to the Cloudron server's API.
    *   Once the data is returned from Cloudron, the handler in `api/users.ts` filters the users to include only those in the specified group.
    *   Finally, it sends the filtered user list back to the frontend as a JSON response.

## 7. How to Run

```bash
./start.sh
```
The script starts the server with the `--watch` flag for automatic reloading.