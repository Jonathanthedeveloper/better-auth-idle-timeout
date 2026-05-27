import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

interface IdleTimeoutOptions {
    timeoutMinutes?: number;
    /**
     * Minimum duration (in seconds) to wait before updating `lastActivityAt` in the DB again.
     * Prevents database write-locking on rapid subsequent requests.
     * Default is 60 seconds (1 minute).
     */
    updateThrottleSeconds?: number;
}

export const idleTimeout = (options: IdleTimeoutOptions = {}) => {
    const {
        timeoutMinutes = 15,
        updateThrottleSeconds = 60
    } = options;

    return {
        id: "idle-timeout",
        schema: {
            session: {
                fields: {
                    lastActivityAt: {
                        type: "date",
                        required: false,
                        unique: false
                    },
                }
            }
        },
        hooks: {
            before: [{
                matcher() {
                    // Match all requests/invocations to verify activity
                    return true;
                },
                handler: createAuthMiddleware(async (ctx) => {
                    const sessionToken = await ctx.getSignedCookie(
                        ctx.context.authCookies.sessionToken.name,
                        ctx.context.secret
                    );
                    if (!sessionToken) return;

                    const session = await ctx.context.internalAdapter.findSession(sessionToken);
                    if (!session) return;

                    const lastActivity = session.session.lastActivityAt
                        ? new Date(session.session.lastActivityAt)
                        : new Date(session.session.updatedAt);

                    const now = Date.now();
                    const inactiveFor = now - lastActivity.getTime();
                    const timeoutMs = timeoutMinutes * 60 * 1000;

                    if (inactiveFor > timeoutMs) {
                        // Revoke session due to inactivity
                        await ctx.context.internalAdapter.deleteSession(sessionToken);
                        throw new APIError("UNAUTHORIZED", {
                            message: "Session expired due to inactivity"
                        });
                    }

                    // Throttle updates: only write to the DB if updateThrottleSeconds have elapsed
                    const throttleMs = updateThrottleSeconds * 1000;
                    if (now - lastActivity.getTime() > throttleMs) {
                        await ctx.context.internalAdapter.updateSession(sessionToken, {
                            lastActivityAt: new Date(now),
                        });
                    }
                })
            }]
        }
    } satisfies BetterAuthPlugin;
};
