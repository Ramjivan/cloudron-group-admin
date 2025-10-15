// services/cloudron.ts
import { logger } from "./logger.ts";

const API_URL_RAW = Deno.env.get("CLOUDRON_API_URL");
const API_TOKEN = Deno.env.get("CLOUDRON_API_TOKEN");

if (!API_URL_RAW || !API_TOKEN) {
    logger.error("CRITICAL: CLOUDRON_API_URL and CLOUDRON_API_TOKEN must be set.");
    throw new Error("CLOUDRON_API_URL and CLOUDRON_API_TOKEN must be set in the environment.");
}

const API_URL = API_URL_RAW.trim().split(',')[0];
let validMailDomains: string[] | null = null;

async function cloudronFetch(path: string, options: RequestInit = {}): Promise<Response> {
    if (!API_URL.startsWith("http")) {
        throw new Error(`Invalid API URL configured: ${API_URL}`);
    }
    const url = `${API_URL}${path}`;
    const method = options.method || "GET";
    logger.debug(`Making API call: ${method} ${url}`);

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${API_TOKEN}`);
    if (options.body) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        const errorBody = await response.text();
        logger.error(`API call failed: ${method} ${url}`, { status: response.status, body: errorBody });
    } else {
        logger.debug(`API call successful: ${method} ${url}`);
    }
    
    return response;
}

export async function checkMailServerDomains() {
    const configuredDomains = Deno.env.get("MAIL_DOMAINS")?.split(',').map(d => d.trim()).filter(Boolean) || [];
    if (configuredDomains.length === 0) {
        logger.warn("No mail domains configured. Mailbox features will be limited.");
        validMailDomains = [];
        return;
    }
    validMailDomains = configuredDomains;
    logger.info(`Using configured mail domains: ${validMailDomains.join(', ')}`);
}

export function getValidMailDomains(): string[] {
    return validMailDomains || [];
}

// --- User Management ---
export async function getUsers() {
    const res = await cloudronFetch("/api/v1/users");
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
}
export async function getUserByUsername(username: string) {
    const res = await cloudronFetch(`/api/v1/users?search=${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error("Failed to fetch user by username");
    const { users } = await res.json();
    return users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
}
export async function createUser(
    username: string, 
    displayName: string, 
    email: string, 
    password: string, 
    fallbackEmail?: string
) {
    const userData: any = {
        username,
        displayName,
        email,
        password,
        role: "user",
    };
    if (fallbackEmail) {
        userData.fallbackEmail = fallbackEmail;
    }

    const res = await cloudronFetch("/api/v1/users", {
        method: "POST",
        body: JSON.stringify(userData),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(`Failed to create user: ${error.message}`);
    }
    return res.json();
}
export async function updateUser(userId: string, data: { displayName: string, email: string, fallbackEmail?: string }) {
    const res = await cloudronFetch(`/api/v1/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(`Failed to update user: ${error.message}`);
    }
    return res.json();
}
export async function deleteUser(userId: string) {
    const res = await cloudronFetch(`/api/v1/users/${userId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete user");
    return { success: true };
}
export async function generatePasswordResetToken(userId: string) {
    const res = await cloudronFetch(`/api/v1/users/${userId}/password_reset_link`, {
        method: "GET",
    });
    if (!res.ok) throw new Error("Failed to generate password reset token from the host server.");
    const data = await res.json();
    if (!data || !data.passwordResetLink) {
        logger.error("API response for password reset was malformed.", { data });
        throw new Error("Received an invalid response from the host server.");
    }
    return { link: data.passwordResetLink };
}
export async function setUserActiveState(userId: string, isActive: boolean) {
    const res = await cloudronFetch(`/api/v1/users/${userId}/active`, {
        method: "PUT",
        body: JSON.stringify({ active: isActive }),
    });
    if (!res.ok) throw new Error(`Failed to set user active state to ${isActive}`);
    return { success: true };
}

export async function setPassword(userId: string, password: string) {
    const res = await cloudronFetch(`/api/v1/users/${userId}/password`, {
        method: "POST",
        body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("Failed to set password");
    return { success: true };
}

// --- Group Management ---
export async function getGroup(groupName: string) {
    const res = await cloudronFetch(`/api/v1/groups?search=${encodeURIComponent(groupName)}`);
    if (!res.ok) throw new Error("Failed to search for group");
    const { groups } = await res.json();
    return groups.find((g: any) => g.name === groupName);
}
export async function getGroupDetails(groupId: string) {
    const res = await cloudronFetch(`/api/v1/groups/${groupId}`);
    if (!res.ok) throw new Error("Failed to get group details");
    return res.json();
}
export async function addUserToGroup(groupId: string, newUserId: string) {
    const groupDetails = await getGroupDetails(groupId);
    if (!groupDetails || !Array.isArray(groupDetails.userIds)) {
        throw new Error("Could not get existing group members from API.");
    }
    const existingUserIds = new Set(groupDetails.userIds);
    if (existingUserIds.has(newUserId)) {
        logger.warn(`User ${newUserId} is already in group ${groupId}. No action taken.`);
        return;
    }
    const updatedUserIds = [...existingUserIds, newUserId];
    const res = await cloudronFetch(`/api/v1/groups/${groupId}/members`, {
        method: "PUT",
        body: JSON.stringify({ userIds: updatedUserIds }),
    });
    if (!res.ok) throw new Error("Failed to add user to group");
    return res.json();
}

// --- Mailbox Management ---
export async function createMailbox(domain: string, name: string, ownerId: string, storageQuota?: number) {
    const res = await cloudronFetch(`/api/v1/mail/${domain}/mailboxes`, {
        method: "POST",
        body: JSON.stringify({
            name: name,
            ownerId: ownerId,
            ownerType: "user",
            active: true,
            storageQuota: storageQuota || 0,
            messagesQuota: 0,
        }),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(`Failed to create mailbox: ${error.message}`);
    }
    return res.json();
}
export async function deleteMailbox(domain: string, name: string) {
    const res = await cloudronFetch(`/api/v1/mail/${domain}/mailboxes/${name}`, {
        method: "DELETE",
        body: JSON.stringify({ deleteMails: false }),
    });
    if (!res.ok) throw new Error("Failed to delete mailbox");
    return { success: true };
}
export async function getMailbox(domain: string, name: string) {
    const res = await cloudronFetch(`/api/v1/mail/${domain}/mailboxes/${name}`);
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to check mailbox status");
    }
    return res.json();
}
export async function listAllMailboxes() {
    await checkMailServerDomains();
    const domains = getValidMailDomains();
    let allMailboxes: any[] = [];
    for (const domain of domains) {
        const res = await cloudronFetch(`/api/v1/mail/${domain}/mailboxes`);
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.mailboxes)) {
                allMailboxes = allMailboxes.concat(data.mailboxes.map(m => ({...m, domain})));
            }
        } else {
            logger.error(`Failed to list mailboxes for verified domain ${domain}.`);
        }
    }
    return allMailboxes;
}

export async function listMailboxesForUser(userId: string) {
    const allMailboxes = await listAllMailboxes();
    return allMailboxes.filter(mbx => mbx.ownerId === userId);
}
