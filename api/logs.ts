// api/logs.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import { getLogs, getStoredPasswords, logger } from "../services/logger.ts";

const logsApp = new Hono();
const AUDIT_KEY = Deno.env.get("AUDIT_KEY");

// Middleware to check for the audit key
const auditAuth = async (c, next) => {
    if (!AUDIT_KEY) {
        logger.error("Audit log access denied: AUDIT_KEY is not configured on the server.");
        return c.json({ error: "Access to this resource is not configured." }, 500);
    }

    const providedKey = c.req.header("X-Audit-Key");
    if (providedKey !== AUDIT_KEY) {
        logger.warn("Audit log access denied: Invalid or missing audit key.");
        return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
};

logsApp.use("/*", auditAuth);

logsApp.get("/", async (c) => {
    logger.info("Request received to view audit logs.");
    try {
        const logs = await getLogs();
        return c.json(logs);
    } catch (error) {
        logger.error("Failed to retrieve logs:", { message: error.message });
        return c.json({ error: "Failed to retrieve logs" }, 500);
    }
});

logsApp.get("/passwords", async (c) => {
    logger.info("Request received to view stored passwords.");
    try {
        const passwords = await getStoredPasswords();
        return c.json(passwords);
    } catch (error) {
        logger.error("Failed to retrieve stored passwords:", { message: error.message });
        return c.json({ error: "Failed to retrieve stored passwords" }, 500);
    }
});

export default logsApp;
