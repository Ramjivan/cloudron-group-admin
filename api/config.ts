// api/config.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import { getValidMailDomains } from "../services/cloudron.ts";
import { logger } from "../services/logger.ts";

const configApp = new Hono();

const brandName = Deno.env.get("BRAND_NAME") || "User Manager";

configApp.get("/", (c) => {
    const validDomains = getValidMailDomains();
    logger.info("Serving config with valid domains:", { domains: validDomains, brandName });
    return c.json({
        domains: validDomains,
        brandName: brandName,
    });
});

export default configApp;

