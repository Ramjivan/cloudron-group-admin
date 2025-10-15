// api/users.ts
import { Hono } from "jsr:@hono/hono@^4.0.0";
import * as cloudron from "../services/cloudron.ts";
import { getStoredPassword, logAction, logger, storePassword } from "../services/logger.ts";

const GROUP_NAME = Deno.env.get("CLOUDRON_GROUP_NAME");
if (!GROUP_NAME) {
    logger.error("CRITICAL: CLOUDRON_GROUP_NAME environment variable is not set.");
    throw new Error("CLOUDRON_GROUP_NAME must be set.");
}
const MASTER_PASSWORD = Deno.env.get("MASTER_PASSWORD");

const usersApp = new Hono();

let managedGroupId: string | null = null;

// Helper to get the group ID on startup or first request
async function getManagedGroupId(): Promise<string> {
    if (managedGroupId) return managedGroupId;
    logger.info(`No cached group ID. Fetching group info for "${GROUP_NAME}"...`);
    const group = await cloudron.getGroup(GROUP_NAME);
    if (!group) {
        logger.error(`Cloudron group "${GROUP_NAME}" not found.`);
        throw new Error(`Cloudron group "${GROUP_NAME}" not found.`);
    }
    managedGroupId = group.id;
    logger.info(`Managing users for group: ${GROUP_NAME} (ID: ${managedGroupId})`);
    return managedGroupId;
}

// --- GET /api/users ---
// Lists users who are members of the configured group, excluding specified accounts
usersApp.get("/", async (c) => {
    logger.info("Request received to list users.");
    try {
        const groupId = await getManagedGroupId();
        const [allUsersRes, groupDetails] = await Promise.all([
            cloudron.getUsers(),
            cloudron.getGroupDetails(groupId),
        ]);

        if (!groupDetails || !Array.isArray(groupDetails.userIds)) {
            logger.error("API response for group details is malformed.", { groupDetails });
            throw new Error("Could not retrieve group members from the host server.");
        }

        const memberIds = new Set(groupDetails.userIds);
        const groupUsers = allUsersRes.users.filter((u: any) => memberIds.has(u.id));

        // Filter out excluded accounts
        const excludeAccounts = new Set(Deno.env.get("EXCLUDE_ACCOUNTS")?.split(',').map(s => s.trim()));
        const filteredUsers = groupUsers.filter((u: any) => !excludeAccounts.has(u.username));
        
        logger.info(`Found ${groupUsers.length} users in group, returning ${filteredUsers.length} after exclusions.`);
        return c.json(filteredUsers);
    } catch (error) {
        logger.error("Error listing users:", { message: error.message });
        return c.json({ error: error.message }, 500);
    }
});

// --- GET /api/users/:username/exists ---
usersApp.get("/:username/exists", async (c) => {
    const username = c.req.param("username");
    try {
        const user = await cloudron.getUserByUsername(username);
        return c.json({ exists: !!user });
    } catch (error) {
        logger.error(`Error checking if user '${username}' exists:`, { message: error.message });
        return c.json({ error: "Failed to check user existence" }, 500);
    }
});

// --- POST /api/users ---
// Creates a user, and optionally a mailbox
usersApp.post("/", async (c) => {
    logger.info("Request received to create a new user.");
    try {
        const { 
            username, 
            displayName, 
            password, 
            email,
            fallbackEmail, 
            createMailbox, 
            mailboxName 
        } = await c.req.json();

        if (!username || !displayName || !password || !email) {
            return c.json({ error: "Username, displayName, password, and email are required" }, 400);
        }

        if (fallbackEmail && fallbackEmail === email) {
            return c.json({ error: "Fallback email cannot be the same as the primary email." }, 400);
        }

        const groupId = await getManagedGroupId();
        const primaryDomain = email.split('@')[1];

        // 1. Create User
        const newUser = await cloudron.createUser(username, displayName, email, password, fallbackEmail);
        await logAction(`Created user '${username}' (ID: ${newUser.id})`);
        await storePassword(username, email, password);

        // 2. Add to Group
        await cloudron.addUserToGroup(groupId, newUser.id);
        await logAction(`Added user '${username}' to group '${GROUP_NAME}'`);

        // 3. Optionally Create Mailbox
        if (createMailbox) {
            if (!primaryDomain) {
                throw new Error("Cannot create default mailbox: No valid mail domains are configured.");
            }
            const mboxName = mailboxName || username;
            await cloudron.createMailbox(primaryDomain, mboxName, newUser.id);
            await logAction(`Created default mailbox '${mboxName}@${primaryDomain}' for '${username}'`);
        }

        logger.info(`Successfully created user '${username}'.`);
        return c.json(newUser, 201);
    } catch (error) {
        logger.error("Error creating user:", { message: error.message });
        return c.json({ error: error.message }, 500);
    }
});

// --- PUT /api/users/:id ---
usersApp.put("/:id", async (c) => {
    const userId = c.req.param("id");
    logger.info(`Request received to update user with ID: ${userId}`);
    try {
        const { displayName, email, fallbackEmail } = await c.req.json();
        if (!displayName || !email) {
            return c.json({ error: "displayName and email are required" }, 400);
        }

        await cloudron.updateUser(userId, { displayName, email, fallbackEmail });
        await logAction(`Updated user info for ID '${userId}'`);
        
        logger.info(`Successfully updated user ${userId}.`);
        return c.json({ success: true });
    } catch (error) {
        logger.error(`Error updating user ${userId}:`, { message: error.message });
        return c.json({ error: error.message }, 500);
    }
});

// --- DELETE /api/users/:id ---
usersApp.delete("/:id", async (c) => {
    const userId = c.req.param("id");
    logger.info(`Request received to delete user with ID: ${userId}`);

    if (!MASTER_PASSWORD) {
        logger.error("User deletion denied: MASTER_PASSWORD is not configured.");
        return c.json({ error: "Access to this resource is not configured." }, 500);
    }
    const providedKey = c.req.header("X-Master-Password");
    if (providedKey !== MASTER_PASSWORD) {
        logger.warn("User deletion denied: Invalid or missing master password.");
        return c.json({ error: "Unauthorized" }, 401);
    }

    try {
        await cloudron.deleteUser(userId);
        await logAction(`Deleted user with ID '${userId}'`);
        logger.info(`Successfully deleted user ${userId}.`);
        return c.json({ success: true });
    } catch (error) {
        logger.error(`Error deleting user ${userId}:`, { message: error.message });
        return c.json({ error: error.message }, 500);
    }
});

// --- POST /api/users/:id/reset-password ---
usersApp.post("/:id/reset-password", async (c) => {
    const userId = c.req.param("id");
    logger.info(`Request received to generate password reset for user ID: ${userId}`);
    try {
        const result = await cloudron.generatePasswordResetToken(userId);
        await logAction(`Generated password reset link for user ID '${userId}'`);
        logger.info(`Successfully generated password reset for user ${userId}.`);
        return c.json(result);
    } catch (error) {
        logger.error(`Error generating password reset for user ${userId}:`, { message: error.message });
        return c.json({ error: error.message }, 500);
    }
});

// --- PUT /api/users/:id/active ---
usersApp.put("/:id/active", async (c) => {
    const userId = c.req.param("id");
    try {
        const { active } = await c.req.json();
        if (typeof active !== "boolean") {
            return c.json({ error: "'active' must be a boolean" }, 400);
        }
        
        await cloudron.setUserActiveState(userId, active);
        const action = active ? "Enabled" : "Disabled";
        await logAction(`${action} user with ID '${userId}'`);
        
        logger.info(`Successfully ${action.toLowerCase()}d user ${userId}.`);
        return c.json({ success: true });
    } catch (error) {
        logger.error(`Error updating active state for user ${userId}:`, { message: error.message });
        return c.json({ error: error.message }, 500);
    }
});

// --- POST /api/users/:id/password ---
usersApp.post("/:id/password", async (c) => {
    const userId = c.req.param("id");
    try {
        const { password, username, email } = await c.req.json();
        if (!password) {
            return c.json({ error: "Password is required" }, 400);
        }
        
        await cloudron.setPassword(userId, password);
        await logAction(`Set password for user with ID '${userId}'`);
        await storePassword(username, email, password);
        
        logger.info(`Successfully set password for user ${userId}.`);
        return c.json({ success: true });
    } catch (error) {
        logger.error(`Error setting password for user ${userId}:`, { message: error.message });
        return c.json({ error: error.message }, 500);
    }
});

export default usersApp;
