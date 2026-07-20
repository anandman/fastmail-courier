import { createHmac } from 'node:crypto';

export interface UiSession {
    sub: string;
    email?: string;
    exp: number;
}

function base64UrlEncode(value: Buffer): string {
    return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Buffer {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64');
}

export function signSession(session: UiSession, secret: string): string {
    const payload = base64UrlEncode(Buffer.from(JSON.stringify(session), 'utf8'));
    const signature = base64UrlEncode(createHmac('sha256', secret).update(payload).digest());
    return `${payload}.${signature}`;
}

export function verifySession(token: string, secret: string): UiSession | null {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expectedSig = base64UrlEncode(createHmac('sha256', secret).update(payload).digest());
    if (signature !== expectedSig) return null;
    try {
        const session = JSON.parse(base64UrlDecode(payload).toString('utf8')) as UiSession;
        if (typeof session.exp !== 'number' || session.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return session;
    } catch {
        return null;
    }
}
