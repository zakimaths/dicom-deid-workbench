# Security and intended use

DICOM Workbench is a learning project for synthetic or explicitly permitted public images. It is not intended for patient care or preparing real patient data for publication.

## Public browser demo

GitHub Pages serves static frontend files only. The published folder contains the page, styles, scripts, fonts and eight known sample assets. It contains no Python service, DICOM containers, credentials or environment files.

The demo has no file picker, upload endpoint, login, analytics, service worker or browser-storage feature. Dropped files are refused without reading them. It fetches samples from the same site and performs display and rectangle edits in the tab. Downloads are PNG previews and exercise reports, not anonymised DICOM files.

The page uses a restrictive content security policy and a no-referrer policy. External profile links open only when selected. GitHub controls the hosting, TLS and response headers; a frontend application cannot promise protection against a compromised host or browser. GitHub also records visitor IP addresses for security purposes. [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).

## Optional local tool

The Python app binds to loopback only. It checks Host and Origin headers, requires a per-launch request token, limits input sizes and keeps one temporary result. That result clears after ten minutes, on a new import or when you choose **Clear**. Responses are marked no-store, and uploads are not deliberately written to disk or logged.

Keep this service local. It is a single-user development server and must not be exposed through a tunnel or reverse proxy. Other local processes, browser extensions, swap and downloaded files are outside its protection boundary. Clearing an object is not secure memory erasure.

Metadata checks and pixel comparisons test specific behaviour. They do not prove that all identifying content has been removed or that no software defects remain. The [audit](docs/audit-0.2.1.md) and [risk record](docs/assurance.md) describe the known gaps.

## Report a security issue

Use **Security → Advisories → Report a vulnerability** in this repository for a private report. Include the version, environment and a synthetic example that shows the problem. Do not attach patient images, real identifiers, confidential logs or identifier mappings. Ordinary, non-sensitive bugs can go in public issues.
