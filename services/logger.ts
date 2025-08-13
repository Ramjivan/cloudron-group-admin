// services/logger.ts

const LOG_FILE = "app.log";

// A simple logger with levels and timestamps that writes to console and file.
const log = (level: "INFO" | "ERROR" | "DEBUG" | "WARN", message: string, data?: object) => {
    const timestamp = new Date().toISOString();
    let logMessage = `${timestamp} [${level}] ${message}`;
    
    if (data) {
        // We will stringify the data for consistent file logging
        logMessage += ` ${JSON.stringify(data)}`;
    }

    // Log to console
    console.log(logMessage);

    // Append to log file
    try {
        Deno.writeTextFileSync(LOG_FILE, logMessage + "\n", { append: true });
    } catch (error) {
        console.log(`Failed to write to log file ${LOG_FILE}:`, error);
    }
};

export const logger = {
    info: (message: string, data?: object) => log("INFO", message, data),
    warn: (message: string, data?: object) => log("WARN", message, data),
    error: (message: string, data?: object) => log("ERROR", message, data),
    debug: (message: string, data?: object) => {
        // Disable debug logging in production
        if (Deno.env.get("APP_ENV") !== "production") {
            log("DEBUG", message, data);
        }
    },
};


// --- Persistent Audit Logging using Deno KV ---

const kv = await Deno.openKv();

export interface LogEntry {
    timestamp: string;
    action: string;
}

/**
 * Records a user-facing action in the persistent audit log.
 * @param action A description of the action performed.
 */
export async function logAction(action: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = { timestamp, action };
    await kv.set(["logs", timestamp], logEntry);
    logger.info(`[AUDIT] ${action}`);
}

/**
 * Retrieves all audit log entries from the KV store.
 * @returns A promise that resolves to an array of log entries.
 */
export async function getLogs(): Promise<LogEntry[]> {
    logger.info("Retrieving audit logs from KV store.");
    const entries = kv.list<LogEntry>({ prefix: ["logs"] });
    const logs: LogEntry[] = [];
    for await (const entry of entries) {
        logs.push(entry.value);
    }
    // Return in reverse chronological order (newest first)
    const sortedLogs = logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    logger.info(`Retrieved ${sortedLogs.length} audit log entries.`);
    return sortedLogs;
}


// --- Log File Access ---

/**
 * Retrieves the content of the application log file.
 * @returns The log file content as a string.
 */
export async function getAppLogFile(): Promise<string> {
    try {
        return await Deno.readTextFile(LOG_FILE);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            logger.warn("Log file not found, returning empty string.");
            return "Log file does not exist yet.";
        }
        logger.error("Failed to read log file:", error);
        throw new Error("Could not read application log file.");
    }
}

// --- Stored Passwords using Deno KV ---

export interface StoredPassword {
    username: string;
    email: string;
    password: string;
    timestamp: string;
}

/**
 * Stores a user's password in the KV store.
 * @param username The user's username.
 * @param email The user's email.
 * @param password The user's new password.
 */
export async function storePassword(username: string, email: string, password: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const storedPassword: StoredPassword = { username, email, password, timestamp };
    await kv.set(["passwords", username], storedPassword);
    logger.info(`[AUDIT] Stored password for user ${username}`);
}

/**
 * Retrieves all stored passwords from the KV store.
 * @returns A promise that resolves to an array of stored passwords.
 */
export async function getStoredPasswords(): Promise<StoredPassword[]> {
    logger.info("Retrieving stored passwords from KV store.");
    const entries = kv.list<StoredPassword>({ prefix: ["passwords"] });
    const passwords: StoredPassword[] = [];
    for await (const entry of entries) {
        passwords.push(entry.value);
    }
    const sortedPasswords = passwords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    logger.info(`Retrieved ${sortedPasswords.length} stored passwords.`);
    return sortedPasswords;
}
