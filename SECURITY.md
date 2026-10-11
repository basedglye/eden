# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Eden, please report it responsibly.

**Email:** security@basedglye.com (or open a GitHub Security Advisory)

**Do NOT open a public issue for security vulnerabilities.**

## Scope

Eden's security model assumes:
- Agents hold their own private keys
- All state is cryptographically signed (Ed25519)
- Content-addressed storage verifies integrity on every read
- Capability tokens are attenuable, delegable, and expire
- Recovery uses Shamir threshold secret sharing (k-of-n)

## Key Storage Warning

The current CLI stores private keys as plaintext hex in `~/.eden/identity/key.enc`. This is MVP-grade. A production deployment should use OS keychain integration or hardware security modules.
