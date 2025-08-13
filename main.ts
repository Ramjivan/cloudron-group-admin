import { Hono } from "jsr:@hono/hono@^4.0.0";
import { serveStatic } from "jsr:@hono/hono@^4.0.0/deno";
import { logger } from "./services/logger.ts";
import * as cloudron from "./services/cloudron.ts";

import { basicAuthMiddleware } from "./api/auth.ts";
import usersApp from "./api/users.ts";
import logsApp from "./api/logs.ts";
import configApp from "./api/config.ts";
import discoveryApp from "./api/discovery.ts";
import mailboxesApp from "./api/mailboxes.ts";

logger.info("Application starting...");

// --- Pre-flight Checks ---
async function runPreflightChecks() {
    logger.info("Running pre-flight checks...");
    // This function now logs warnings instead of throwing errors for invalid domains.
    await cloudron.checkMailServerDomains();
}

const app = new Hono();

// --- MIDDLEWARE ---
// Custom request logger
app.use('*', async (c, next) => {
    await next();
    logger.info(`${c.req.method} ${c.req.path} - ${c.res.status}`);
});

// --- API ROUTES ---
// All API routes are protected by Basic Auth.
const api = new Hono();
api.use("/*", basicAuthMiddleware);
api.route("/users", usersApp);
api.route("/logs", logsApp);
api.route("/config", configApp);
api.route("/discovery", discoveryApp);
api.route("/mailboxes", mailboxesApp);

app.route("/api", api);


// --- STATIC FILE SERVING ---
// Serve the static assets from the './static' directory
app.get("/*", serveStatic({ root: "./static" }));


// --- START SERVER ---
runPreflightChecks().then(() => {
    const isProduction = Deno.env.get("APP_ENV") === "production";
    logger.info(`Starting in ${isProduction ? "production" : "development"} mode.`);

    if (isProduction) {
      logger.info("Deno will manage the port.");
      Deno.serve(app.fetch);
    } else {
      const port = Number(Deno.env.get("PORT")) || 8020;
      logger.info(`Server starting on http://localhost:${port}`);
      Deno.serve({ port: port }, app.fetch);
    }
});
