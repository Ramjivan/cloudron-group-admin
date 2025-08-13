// api/mailboxes.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import * as cloudron from "../services/cloudron.ts";
import { logAction, logger } from "../services/logger.ts";

const mailboxesApp = new Hono();

// GET /api/mailboxes - List all mailboxes, excluding those of excluded users
mailboxesApp.get("/", async (c) => {
    try {
        const [mailboxes, users] = await Promise.all([
            cloudron.listAllMailboxes(),
            cloudron.getUsers(),
        ]);

        const excludeAccounts = new Set(Deno.env.get("EXCLUDE_ACCOUNTS")?.split(',').map(s => s.trim()));
        const userMap = new Map(users.users.map(u => [u.id, u.username]));

        const filteredMailboxes = mailboxes.filter(mbx => {
            const ownerUsername = userMap.get(mbx.ownerId);
            return ownerUsername && !excludeAccounts.has(ownerUsername);
        });

        logger.info(`Found ${mailboxes.length} total mailboxes, returning ${filteredMailboxes.length} after exclusions.`);
        return c.json(filteredMailboxes);
    } catch (error) {
        logger.error("Error listing mailboxes:", { message: error.message });
        return c.json({ error: "Failed to list mailboxes" }, 500);
    }
});

// POST /api/mailboxes - Create a new mailbox
mailboxesApp.post("/", async (c) => {
    try {
        const { name, domain, ownerId } = await c.req.json();
        if (!name || !domain || !ownerId) {
            return c.json({ error: "name, domain, and ownerId are required" }, 400);
        }
        // The ownerId is passed directly from the frontend select menu.
        const newMailbox = await cloudron.createMailbox(domain, name, ownerId);
        await logAction(`Created mailbox '${name}@${domain}'`);
        return c.json(newMailbox, 201);
    } catch (error) {
        logger.error("Error creating mailbox:", { message: error.message });
        return c.json({ error: "Failed to create mailbox" }, 500);
    }
});

// DELETE /api/mailboxes/:domain/:name - Delete a mailbox
mailboxesApp.delete("/:domain/:name", async (c) => {
    const { domain, name } = c.req.param();
    try {
        await cloudron.deleteMailbox(domain, name);
        await logAction(`Deleted mailbox '${name}@${domain}'`);
        return c.json({ success: true });
    } catch (error) {
        logger.error(`Error deleting mailbox ${name}@${domain}:`, { message: error.message });
        return c.json({ error: "Failed to delete mailbox" }, 500);
    }
});

// GET /api/mailboxes/:domain/:name/exists - Check if a mailbox exists
mailboxesApp.get("/:domain/:name/exists", async (c) => {
    const { domain, name } = c.req.param();
    try {
        const mailbox = await cloudron.getMailbox(domain, name);
        return c.json({ exists: !!mailbox });
    } catch (error) {
        logger.error(`Error checking mailbox ${name}@${domain}:`, { message: error.message });
        return c.json({ error: "Failed to check mailbox status" }, 500);
    }
});

export default mailboxesApp;