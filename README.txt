MY LEDGER PWA – SECURITY + REMINDERS

New features:
1. Face ID / Touch ID / biometrics through WebAuthn/Passkeys where supported.
2. PIN fallback.
3. Auto-lock: Never, 1, 5, or 15 minutes.
4. Daily entry reminder configurable from Settings (default 22:00).
5. Test notification button.
6. Service worker push-event support for future server-side push.

IMPORTANT:
- HTTPS is required for WebAuthn and notifications.
- The included daily reminder scheduler runs while the PWA/browser is active.
- For guaranteed delivery at an exact time when the app is fully closed, add a backend push service and scheduler (VAPID/Web Push, Firebase, OneSignal, etc.).
- The biometric lock is client-side PWA protection; a production-grade authentication design should verify WebAuthn assertions on a server.
