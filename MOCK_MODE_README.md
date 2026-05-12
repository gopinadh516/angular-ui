# Frontend-only mock mode

This copy of the Angular UI can run without the Java backend or PostgreSQL.

## Run

```bash
npm install
npm start
```

Open the app and login with any email/password. The mock interceptor accepts all logins.

Useful mock users:

- `admin@surescripts.local` -> SUPER_ADMIN
- `manager@surescripts.local` -> AR_MANAGER
- `ar.agent@surescripts.local` -> AR_AGENT
- `code.agent@surescripts.local` -> CODE_AGENT
- `charge.agent@surescripts.local` -> CHARGE_AGENT
- `pay.agent@surescripts.local` -> PAY_AGENT
- `client@surescripts.local` -> CLIENT

## What was added

- `src/app/mock/mock-api.interceptor.ts` intercepts `/api/...` calls.
- `src/app/mock/mock-data.ts` contains synthetic TypeScript mock objects.
- `src/assets/mock-data/*.json` contains the same mock data as JSON files for reference.
- `src/environments/environment.ts` has `useMockData: true`.
- `src/environments/environment.prod.ts` has `useMockData: false`.

## Turning mock mode off

Set this in `src/environments/environment.ts`:

```ts
useMockData: false
```

Then the Angular app will call the real backend again.

## Scope for UI developer

The UI developer should mainly change SCSS and minor HTML structure/classes. Avoid changing services, route guards, models, and business logic unless required for layout.
