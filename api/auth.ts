// api/auth.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import { logger } from "../services/logger.ts";
import type { Context, Next } from "jsr:@hono/hono@^4.0.0";

const DASHBOARD_USERNAME = Deno.env.get("DASHBOARD_USERNAME");
const DASHBOARD_PASSWORD = Deno.env.get("DASHBOARD_PASSWORD");

if (!DASHBOARD_USERNAME || !DASHBOARD_PASSWORD) {
    logger.error("CRITICAL: DASHBOARD_USERNAME and DASHBOARD_PASSWORD must be set for Basic Auth.");
    throw new Error("DASHBOARD_USERNAME and DASHBOARD_PASSWORD must be set.");
}

/**
 * Middleware for HTTP Basic Authentication.
 */
export const basicAuthMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Basic ")) {
        logger.warn("Auth failed: Missing or invalid Authorization header.");
        return c.text("Unauthorized", 401, { "WWW-Authenticate": 'Basic realm="User Management"' });
    }

    try {
        const encodedCreds = authHeader.split(" ")[1];
        const decodedCreds = atob(encodedCreds);
        const [username, password] = decodedCreds.split(":");

        logger.debug(`Basic Auth attempt for user: ${username}`);

        if (username === DASHBOARD_USERNAME && password === DASHBOARD_PASSWORD) {
            logger.info(`Basic Auth successful for user: ${username}`);
            await next();
        } else {
            logger.warn(`Auth failed: Invalid credentials for user: ${username}`);
            return c.text("Unauthorized", 401, { "WWW-Authenticate": 'Basic realm="User Management"' });
        }
    } catch (e) {
        logger.error("Auth failed: Could not decode credentials.", { error: e.message });
        return c.text("Unauthorized", 401, { "WWW-Authenticate": 'Basic realm="User Management"' });
    }
};