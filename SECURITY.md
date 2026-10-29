# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
private vulnerability reporting (Security → Report a vulnerability) on the
repository, or contact the maintainer directly. You will get an
acknowledgement within a few days.

Include: affected version/commit, a minimal reproduction, and the impact you
believe it has.

## What is in scope

- The admin/worker application (authentication, session handling, API routes).
- Token handling: GitHub tokens, AI provider keys, invitation tokens.
- Anything that could leak repository content or allow writes without
  authorization.

## Design notes (why things are the way they are)

- **Secrets never touch the repository.** GitHub tokens and AI provider keys
  are stored encrypted (AES-GCM, `TOKEN_ENCRYPTION_KEY`) in D1 and are used
  server-side only. Invitation tokens are single-use and email-bound.
- **Content is the customer's repository.** The CMS database holds identity,
  project membership and media metadata only (ADR 0006).
- **Shared projects use per-user credentials.** Invited members work with
  their own GitHub connection; the owner's token is never shared with a
  member.
- **The AI proxy is server-side.** Provider calls (and therefore API keys)
  never happen in the browser.

## Supported versions

The project is pre-1.0; fixes are applied to the latest `main`.
