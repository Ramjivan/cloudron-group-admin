// api/logs.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import { logAction as saveLogAction } from "../services/logger.ts";

const logsApp = new Hono();

logsApp.post("/audit", async (c) => {
    try {
        const { action } = await c.req.json();
        if (!action) {
            return c.json({ error: "Action is required" }, 400);
        }
        await saveLogAction(action);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: "Failed to log action" }, 500);
    }
});

export default logsApp;