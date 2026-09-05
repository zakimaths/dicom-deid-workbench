# Security and intended use

This is an educational, single-user localhost prototype for synthetic or already-public DICOM files. It is not intended for patient care or for anonymising real patient data for disclosure.

The app uses loopback-only binding, Host/Origin checks, a per-launch request token, no-store responses, a restrictive content security policy, capped uploads and one temporary result with a ten-minute lifetime. It does not intentionally write uploaded files to disk or log their values. Clearing objects does not securely erase memory, swap, downloads or browser-extension copies.

Do not tunnel it, proxy it to the internet, run it on a shared machine with sensitive files, or treat a successful export as a privacy clearance. The standard-library server is not hardened against hostile local processes. The parser and browser are part of the trust boundary.

## Reporting a vulnerability

Use the repository's **Security → Advisories → Report a vulnerability** feature for private reporting. Include only a synthetic reproduction, the release version and the environment. Do not attach patient images, real identifiers, confidential logs or re-identification maps. General non-sensitive bugs can use public issues.
