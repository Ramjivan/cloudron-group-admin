// api/logs.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import { getLogs, getStoredPasswords, logger } from "../services/logger.ts";

const logsApp = new Hono();
const MASTER_PASSWORD = Deno.env.get("MASTER_PASSWORD");

// Middleware to check for the master password
const auditAuth = async (c, next) => {
    if (!MASTER_PASSWORD) {
        logger.error("Audit log access denied: MASTER_PASSWORD is not configured on the server.");
        return c.json({ error: "Access to this resource is not configured." }, 500);
    }

    const providedKey = c.req.header("X-Master-Password");
    if (providedKey !== MASTER_PASSWORD) {
        logger.warn("Audit log access denied: Invalid or missing master password.");
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
