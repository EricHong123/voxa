# Security policy

Voxa is an experimental desktop application. Only the latest source revision is maintained; there is no security support SLA.

For vulnerabilities involving arbitrary input injection, IPC access, external data transmission, or local file disclosure, use this repository's **Security → Report a vulnerability** private reporting flow. Do not post private transcripts, credentials, or exploitable details in a public issue. If private reporting is unavailable, open an issue requesting a private contact without technical details.

The app uses macOS Accessibility for input delivery and plaintext local history. Keep endpoints on loopback, review your model server configuration, and test with non-sensitive text. Do not disable platform security to work around installation issues. See the README for the data flow and current limits.
