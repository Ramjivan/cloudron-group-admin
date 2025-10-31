# Project Overview

This is a web application for managing Cloudron groups and users. It provides a web interface to perform CRUD (Create, Read, Update, Delete) operations on users, as well as manage group memberships and mailboxes.

The application is built with [Deno](https://deno.land/) and [Hono](https://hono.dev/). The frontend is a simple HTML, CSS, and JavaScript application served statically. The backend provides a RESTful API for the frontend to interact with.

The core logic for interacting with the Cloudron API is encapsulated in the `services/cloudron.ts` file. This service handles all the communication with the Cloudron API, including authentication and data transformation. The application also uses Deno's built-in key-value store to persist some data.

## Building and Running

### Prerequisites

- [Deno](https://deno.land/)

### Setup

1.  Clone the repository.
2.  Create a `.env` file by copying `.env.example` and filling in the required values. The required environment variables are:
    *   `CLOUDRON_API_URL`: The URL of your Cloudron API.
    *   `CLOUDRON_API_TOKEN`: Your Cloudron API token.
    *   `CLOUDRON_GROUP_NAME`: The name of the Cloudron group to manage.
    *   `MASTER_PASSWORD`: A master password for basic authentication.

### Running the application

To start the development server, run:

```bash
./start.sh
```

This will start the server on `http://localhost:8020` and watch for file changes.

You can also use the `deno` task runner directly:

```bash
deno task dev
```

### Production

To run the application in production, use the `start` task:

```bash
deno task start
```

In a production environment, you should set the `APP_ENV` environment variable to `production`.

## Development Conventions

The project follows the standard Deno conventions. The code is written in TypeScript and uses ES modules. The code is formatted using `deno fmt`.

The project has a clear separation of concerns. The API routes are defined in the `api/` directory, and the services are defined in the `services/` directory. The frontend is located in the `static/` directory.

The application uses a custom logger for logging. The logger is configured to log to the console and to a file.

The application uses basic authentication to protect the API routes. The master password is read from the `MASTER_PASSWORD` environment variable.
