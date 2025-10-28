# Cloudron Group Admin

This is a web application for managing Cloudron groups and users.

## Development

### Prerequisites

- [Deno](https://deno.land/)

### Setup

1.  Clone the repository.
2.  Create a `.env` file by copying `.env.example` and filling in the required values.

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

## Production

To run the application in production, use the `start` task:

```bash
deno task start
```

In a production environment, you should set the `APP_ENV` environment variable to `production`.
