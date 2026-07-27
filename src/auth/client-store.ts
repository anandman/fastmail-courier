import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

/**
 * Two-phase client registry.
 *
 * `POST /register` is unauthenticated by RFC 7591, so anyone on the internet can
 * call it. New registrations are therefore provisional: they carry a TTL, they
 * count against a hard cap, and the oldest is evicted once that cap is reached.
 * A client becomes permanent only once an allowlisted human has completed an
 * authorization with it, and permanent entries never expire and are never
 * evicted. Anonymous traffic can consume at most `maxProvisional` slots.
 *
 * Provisional entries are persisted rather than held in memory. Clients cache
 * the `client_id` they were issued and do not re-register when it stops being
 * recognised, so a restart between registration and first authorization would
 * otherwise break a client permanently. The cap is what bounds disk use here;
 * keeping them in memory only bought durability problems, not safety.
 */
export interface CourierClientStoreOptions {
    filePath: string;
    provisionalTtlMs?: number;
    maxProvisional?: number;
}

/** `expiresAt: null` marks a promoted client: permanent, never evicted. */
interface StoredClient {
    client: OAuthClientInformationFull;
    expiresAt: number | null;
}

interface ClientFileData {
    version: number;
    clients: Record<string, StoredClient>;
}

const DEFAULT_PROVISIONAL_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_PROVISIONAL = 500;

export class CourierClientStore implements OAuthRegisteredClientsStore {
    private readonly filePath: string;
    private readonly provisionalTtlMs: number;
    private readonly maxProvisional: number;
    private clients: Map<string, StoredClient> | null = null;
    private writeQueue: Promise<unknown> = Promise.resolve();

    constructor(options: CourierClientStoreOptions) {
        this.filePath = options.filePath;
        this.provisionalTtlMs = options.provisionalTtlMs ?? DEFAULT_PROVISIONAL_TTL_MS;
        this.maxProvisional = options.maxProvisional ?? DEFAULT_MAX_PROVISIONAL;
    }

    async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
        const clients = await this.load();
        const entry = clients.get(clientId);
        if (!entry) return undefined;

        if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
            clients.delete(clientId);
            await this.flush(clients);
            return undefined;
        }

        return entry.client;
    }

    async registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
        const clients = await this.load();
        this.pruneExpired(clients);

        // Evict the oldest provisional entry rather than rejecting, so a flood
        // degrades into retries for legitimate clients instead of a hard outage.
        // Promoted clients are skipped: a flood must never displace one.
        while (this.countProvisional(clients) >= this.maxProvisional) {
            const oldest = [...clients.entries()]
                .filter(([, entry]) => entry.expiresAt !== null)
                .sort((a, b) => (a[1].expiresAt ?? 0) - (b[1].expiresAt ?? 0))[0];
            if (!oldest) break;
            clients.delete(oldest[0]);
        }

        const clientId = client.client_id || randomUUID();
        const registered: OAuthClientInformationFull = { ...client, client_id: clientId };
        clients.set(clientId, { client: registered, expiresAt: Date.now() + this.provisionalTtlMs });
        await this.flush(clients);

        return registered;
    }

    /**
     * Marks a client permanent. Called only after an allowlisted user has
     * completed an authorization code exchange with it.
     */
    async promoteClient(clientId: string): Promise<void> {
        const clients = await this.load();
        const entry = clients.get(clientId);
        if (!entry || entry.expiresAt === null) return;

        clients.set(clientId, { ...entry, expiresAt: null });
        await this.flush(clients);
    }

    private countProvisional(clients: Map<string, StoredClient>): number {
        let count = 0;
        for (const entry of clients.values()) {
            if (entry.expiresAt !== null) count += 1;
        }
        return count;
    }

    private pruneExpired(clients: Map<string, StoredClient>): void {
        const now = Date.now();
        for (const [clientId, entry] of clients) {
            if (entry.expiresAt !== null && entry.expiresAt <= now) {
                clients.delete(clientId);
            }
        }
    }

    private async load(): Promise<Map<string, StoredClient>> {
        if (this.clients) return this.clients;

        try {
            const raw = await readFile(this.filePath, 'utf8');
            const data = JSON.parse(raw) as ClientFileData;
            this.clients = new Map(Object.entries(data.clients ?? {}));
        } catch (error) {
            if (isNodeError(error) && error.code !== 'ENOENT') throw error;
            this.clients = new Map();
        }

        return this.clients;
    }

    private async flush(clients: Map<string, StoredClient>): Promise<void> {
        const data: ClientFileData = { version: 2, clients: Object.fromEntries(clients) };
        const write = this.writeQueue.catch(() => undefined).then(() => this.writeFile(data));
        this.writeQueue = write.catch(() => undefined);
        await write;
    }

    private async writeFile(data: ClientFileData): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        const tmpPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;

        try {
            await writeFile(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
            await rename(tmpPath, this.filePath);
            await chmod(this.filePath, 0o600).catch(() => undefined);
        } catch (error) {
            await unlink(tmpPath).catch(() => undefined);
            throw error;
        }
    }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}
