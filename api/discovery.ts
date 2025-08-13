// api/discovery.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import * as cloudron from "../services/cloudron.ts";
import { logger } from "../services/logger.ts";

const discoveryApp = new Hono();

discoveryApp.get("/", async (c) => {
    logger.info("Performing API discovery...");
    try {
        const apiRoot = await cloudron.getApiRoot();
        return c.json(apiRoot);
    } catch (error) {
        logger.error("API discovery failed:", { message: error.message });
        return c.json({ error: "Failed to fetch API root" }, 500);
    }
});

export default discoveryApp;
