# Better Auth Idle Timeout Plugin

The Idle Timeout plugin automatically expires and revokes sessions after a specified period of user inactivity (idle time). It tracks user activity and automatically terminates the session in the database if no activity is detected within a timeout window. To prevent database write-locking and reduce database load, the plugin includes write-throttling on activity updates.

## Installation

### 1. Install the package

Install the package via your preferred package manager:

```bash
# Using bun
bun add better-auth-idle-timeout

# Using npm
npm install better-auth-idle-timeout

# Using pnpm
pnpm add better-auth-idle-timeout
```

### 2. Add the plugin to your auth config

To use the Idle Timeout plugin, add it to your server-side auth config:

```ts
import { betterAuth } from "better-auth"
import { idleTimeout } from "better-auth-idle-timeout"

export const auth = betterAuth({
    // ... other config options
    plugins: [
        idleTimeout({
            timeoutMinutes: 15,          // Optional: default is 15 minutes
            updateThrottleSeconds: 60    // Optional: default is 60 seconds
        })
    ]
})
```

### 3. Migrate the database

Run the migration or generate the schema to add the necessary fields to the database:

```bash
# Run migration
npx better-auth migrate

# Or generate schema
npx better-auth generate
```

See the [Schema](#schema) section to add the fields manually.

## Options

### timeoutMinutes

The period of inactivity (in minutes) after which a session is considered idle and gets revoked. Defaults to `15`.

```ts
idleTimeout({
  timeoutMinutes: 30, // 30 minutes
})
```

### updateThrottleSeconds

Cooldown period (in seconds) during which requests will not write a new `lastActivityAt` value to the database, reducing database load. Defaults to `60`.

```ts
idleTimeout({
  updateThrottleSeconds: 120, // 2 minutes
})
```

## How It Works

1. **Global Request Hook**: A `before` hook interceptor runs on all incoming requests.
2. **Inactivity Assessment**:
   - The plugin retrieves the session token from the signed session cookie.
   - It computes the time difference between the current time and the session's last activity (`lastActivityAt` or falls back to `updatedAt`).
   - If the inactive duration exceeds `timeoutMinutes`, the session is permanently deleted from the database and the request is rejected with an `UNAUTHORIZED` `APIError` containing the message `"Session expired due to inactivity"`.
3. **Throttled Updates**: If the session is active and valid, it updates the `lastActivityAt` timestamp in the database only if `updateThrottleSeconds` has elapsed since the last activity was recorded.

## Schema

This plugin adds the following field to the `session` table:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `lastActivityAt` | `Date` (optional) | The timestamp of the user's last activity. Updates are throttled to prevent write lock on rapid subsequent requests. |

---

## License

MIT © [Jonathan](https://github.com/Jonathanthedeveloper)
