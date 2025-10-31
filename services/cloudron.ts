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
export async function getUsers(page = 1, per_page = 20, search?: string, active?: boolean) {
    let path = `/api/v1/users?page=${page}&per_page=${per_page}`;
    if (search) {
        path += `&search=${encodeURIComponent(search)}`;
    }
    if (typeof active === 'boolean') {
        path += `&active=${active}`;
    }
    const res = await cloudronFetch(path);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
}

export async function getAllUsers() {
    let allUsers: any[] = [];
    let page = 1;
    const per_page = 50;
    while (true) {
        const data = await getUsers(page, per_page);
        const users = data.users;
        if (users.length === 0) {
            break;
        }
        allUsers = allUsers.concat(users);
        page++;
    }
    return allUsers;
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
    const newUser = await res.json();

    // Automatically add user to the default group
    const groupName = Deno.env.get("CLOUDRON_GROUP_NAME");
    if (groupName) {
        try {
            const group = await getGroup(groupName);
            if (group && group.id) {
                await addUserToGroup(group.id, newUser.id);
                logger.info(`Successfully added user ${newUser.id} to group ${groupName} (${group.id}).`);
            } else {
                logger.warn(`Default group '${groupName}' not found. User was created but not added to any group.`);
            }
        } catch (error) {
            logger.error(`Failed to add user ${newUser.id} to group '${groupName}':`, error);
            // Do not re-throw; the user was still created successfully.
        }
    } else {
        logger.warn("CLOUDRON_GROUP_NAME is not set. User was created but not added to any group.");
    }

    // Store the password in Deno KV
    try {
        const kv = await Deno.openKv();
        await kv.set(["passwords", newUser.id], password);
        logger.info(`Password for new user ${newUser.id} stored in KV.`);
    } catch (error) {
        logger.error(`Failed to store password for new user ${newUser.id} in KV:`, error);
        // Even if KV fails, the user was created in Cloudron, so we don't re-throw.
    }

    return newUser;
}
export async function updateUser(userId: string, data: { displayName: string, email: string, fallbackEmail?: string }) {
    const res = await cloudronFetch(`/api/v1/users/${userId}/profile`, {
        method: "POST",
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorBody = await res.text();
        let errorMessage = errorBody;
        try {
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.message || errorMessage;
        } catch (e) {
            // Not a JSON response, use the raw text.
            logger.debug("API error response was not valid JSON.", { body: errorBody });
        }
        throw new Error(`Failed to update user: ${errorMessage}`);
    }
    
    // Handle empty response body for successful requests
    const contentLength = res.headers.get("content-length");
    if (!contentLength || contentLength === "0") {
        return { success: true };
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

    // Store the password in Deno KV
    try {
        const kv = await Deno.openKv();
        await kv.set(["passwords", userId], password);
        logger.info(`Password for user ${userId} stored in KV.`);
    } catch (error) {
        logger.error(`Failed to store password for user ${userId} in KV:`, error);
        // Decide if you want to throw an error here or just log it
    }

    return { success: true };
}

export async function getPassword(userId: string): Promise<string | null> {
    try {
        const kv = await Deno.openKv();
        const result = await kv.get<string>(["passwords", userId]);
        return result.value;
    } catch (error) {
        logger.error(`Failed to retrieve password for user ${userId} from KV:`, error);
        return null;
    }
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
export async function createMailbox(domain: string, name: string, ownerId: string) {
    const res = await cloudronFetch(`/api/v1/mail/${domain}/mailboxes`, {
        method: "POST",
        body: JSON.stringify({
            name: name,
            ownerId: ownerId,
            ownerType: "user",
            active: true,
            storageQuota: 0,
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
async function listMailboxesForDomain(domain: string) {
    let mailboxes: any[] = [];
    let page = 1;
    const per_page = 50;
    while (true) {
        const res = await cloudronFetch(`/api/v1/mail/${domain}/mailboxes?page=${page}&per_page=${per_page}`);
        if (!res.ok) {
            logger.error(`Failed to list mailboxes for domain ${domain}.`);
            break;
        }
        const data = await res.json();
        if (data && Array.isArray(data.mailboxes) && data.mailboxes.length > 0) {
            mailboxes = mailboxes.concat(data.mailboxes.map(m => ({...m, domain})));
            page++;
        } else {
            break;
        }
    }
    return mailboxes;
}

export async function listAllMailboxes() {
    await checkMailServerDomains();
    const domains = getValidMailDomains();
    let allMailboxes: any[] = [];
    for (const domain of domains) {
        const domainMailboxes = await listMailboxesForDomain(domain);
        allMailboxes = allMailboxes.concat(domainMailboxes);
    }
    return allMailboxes;
}

export async function listMailboxesForUser(userId: string) {
    const allMailboxes = await listAllMailboxes();
    return allMailboxes.filter(mbx => mbx.ownerId === userId);
}
