import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

/**
 * Two-phase client registry.
 *
 * `POST /register` is unauthenticated by RFC 7591, so anyone on the internet can
 * call it. Registrations therefore start in memory only, bounded by a TTL and a
 * hard cap, and are never written to disk. A client is persisted only once an
 * allowlisted human has completed an authorization with it, which means
 * anonymous traffic cannot cause a disk write no matter how much of it arrives.
 */
export interface CourierClientStoreOptions {
    filePath: string;
    provisionalTtlMs?: number;
    maxProvisional?: number;
}

interface ProvisionalEntry {
    client: OAuthClientInformationFull;
    expiresAt: number;
}

interface ClientFileData {
    version: number;
    clients: Record<string, OAuthClientInformationFull>;
}

const DEFAULT_PROVISIONAL_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_PROVISIONAL = 500;

export class CourierClientStore implements OAuthRegisteredClientsStore {
    private readonly filePath: string;
    private readonly provisionalTtlMs: number;
    private readonly maxProvisional: number;
    private readonly provisional = new Map<string, ProvisionalEntry>();
    private persisted: Map<string, OAuthClientInformationFull> | null = null;
    private writeQueue: Promise<unknown> = Promise.resolve();

    constructor(options: CourierClientStoreOptions) {
        this.filePath = options.filePath;
        this.provisionalTtlMs = options.provisionalTtlMs ?? DEFAULT_PROVISIONAL_TTL_MS;
        this.maxProvisional = options.maxProvisional ?? DEFAULT_MAX_PROVISIONAL;
    }

    async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
        const persisted = await this.loadPersisted();
        const stored = persisted.get(clientId);
        if (stored) return stored;

        this.pruneProvisional();
        return this.provisional.get(clientId)?.client;
    }

    async registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
        this.pruneProvisional();

        // Evict the oldest provisional entry rather than rejecting, so a flood
        // degrades into retries for legitimate clients instead of a hard outage.
        while (this.provisional.size >= this.maxProvisional) {
            const oldest = this.provisional.keys().next();
            if (oldest.done) break;
            this.provisional.delete(oldest.value);
        }

        const clientId = client.client_id || randomUUID();
        const registered: OAuthClientInformationFull = { ...client, client_id: clientId };
        this.provisional.set(clientId, {
            client: registered,
            expiresAt: Date.now() + this.provisionalTtlMs,
        });

        return registered;
    }

    /**
     * Moves a client from the in-memory registry to durable storage. Called only
     * after an allowlisted user has completed an authorization code exchange.
     */
    async promoteClient(clientId: string): Promise<void> {
        const entry = this.provisional.get(clientId);
        if (!entry) return;

        const persisted = await this.loadPersisted();
        if (!persisted.has(clientId)) {
            persisted.set(clientId, entry.client);
            await this.flush(persisted);
        }
        this.provisional.delete(clientId);
    }

    private pruneProvisional(): void {
        const now = Date.now();
        for (const [clientId, entry] of this.provisional) {
            if (entry.expiresAt <= now) {
                this.provisional.delete(clientId);
            }
        }
    }

    private async loadPersisted(): Promise<Map<string, OAuthClientInformationFull>> {
        if (this.persisted) return this.persisted;

        try {
            const raw = await readFile(this.filePath, 'utf8');
            const data = JSON.parse(raw) as ClientFileData;
            this.persisted = new Map(Object.entries(data.clients ?? {}));
        } catch (error) {
            if (isNodeError(error) && error.code !== 'ENOENT') throw error;
            this.persisted = new Map();
        }

        return this.persisted;
    }

    private async flush(clients: Map<string, OAuthClientInformationFull>): Promise<void> {
        const data: ClientFileData = { version: 1, clients: Object.fromEntries(clients) };
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
