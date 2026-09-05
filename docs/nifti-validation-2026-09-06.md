# NIfTI checks - 6 September 2026

This pass covers the first scalar-3D NIfTI-1 viewer and header-cleaning implementation. It does not validate facial anonymisation or clinical use.

- 30 NIfTI Python checks cover four voxel types, both byte orders, header/extension removal, scaling, oblique and dual coordinate spaces, gzip wrappers, malformed headers, truncated data, invalid orientation, non-finite voxels, expansion limits and pinned assets.
- The complete Python suite passes: 259 tests, including same-origin/session-token and stateless NIfTI endpoint checks. The first sandboxed server-test attempt could not bind sockets; the suite passed when run with local-server permission.
- Nine local browser workflows pass across Chromium, Firefox and WebKit at 1280, 390 and 320 pixels. They exercise slice directions, next/previous, zoom out, fit, contrast, reset, cleanup, failed imports, header cleaning and gated downloads.
- All nine actual downloaded files are independently parsed and compared with 61,440 expected synthetic voxel values each. Raw values, geometry and header removals match. These are repeated software checks, not nine independent patients.
- Nine screenshots of the asymmetric fixture place its brighter right-hand marker on the picture's left, matching the declared radiological convention.
- Six public browser workflows pass across the same engines at 1280 and 320 pixels. They exercise navigation from the home page, both teaching volumes, sample checksum failures, missing local import/export controls and no API/external requests.
- Loaded local/public states have no detected axe WCAG A/AA violations, horizontal page overflow or uncaught browser errors. Desktop and narrow layouts were visually reviewed; coordinate formatting and larger direction labels were corrected.
- Existing public and local DICOM browser workflows pass in all three engines, including the 50-image library and 21 independently checked DICOM exports. Existing 16 JavaScript pixel/challenge checks pass. Only synthetic fixtures and the cited public CC0 MRI were used; no private hospital data was used.

Machine-readable results and screenshots are generated under `output/nifti-browser/` and `output/nifti-preview/`. Tests run in CI and the public viewer check is a Pages deployment gate. The fixture generator, dependency locks, sample checksums, vendor hash and source preparation make the checks repeatable.

Limits: this is browser emulation on the development Mac, not physical iPhone/iPad or installed Safari testing. VoiceOver/TalkBack, memory benchmarks across real devices, independent hospital cohorts, privacy recall on unknown identifiers, volumetric defacing, BIDS and 4D remain untested or unsupported. Zero detected software failures is not a clinical accuracy score.
