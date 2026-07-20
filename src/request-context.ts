import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { AccountManager } from './account-manager.js';

export interface RequestContext {
    accountManager?: AccountManager;
    authInfo?: AuthInfo;
    userId?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
    return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
    return requestContextStorage.getStore();
}
