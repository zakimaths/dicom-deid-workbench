# Assurance scope, requirements and residual risks

Owner: project maintainer. Review date: 5 September 2026. Intended use: local educational work with synthetic or explicitly permitted public fixtures. This is an engineering evidence record, not a compliance assessment or a clinical release approval.

## Threat model

Inputs are untrusted files even when loaded locally. Protected material may occur in metadata, stored pixels, alternate image/graphic objects and recognisable anatomy. A recipient may also hold original images or other identifying information. The service assumes a single user on loopback; hostile extensions, other local processes, swap/crash dumps and files deliberately downloaded by the user are outside its isolation guarantee.

The principal boundary is the exported DICOM and its report. The browser shows a preview of the processed output. Pending rectangles are visibly outlined and suspend normal UI downloads. The edit request is checked against the current opaque job, and failures invalidate its result. UI acknowledgement communicates limitations; it is not authorisation infrastructure or proof of a privacy assessment. A local caller with the session token can use the API directly; server-side enforcement of a future formal review is a separate requirement.

## Requirement-to-evidence matrix

| Requirement | Implementation | Evidence | Limit |
| --- | --- | --- | --- |
| R01: approved metadata subset only | core.py, verification.py | test_core.py; injected private/name/UID/sequence/VR failures in test_redaction.py | Custom contract shares pydicom and policy constants; not IOD validation |
| R02: overwrite selected stored pixels | redaction.py | NumPy oracle across signed/unsigned, polarity and rescale cases | Manual rectangles only; coverage of identifying content is not established |
| R03: preserve outside-mask samples | redaction.py independent verifier | Corruption of an outside-mask byte is rejected | Same file format envelope as importer |
| R04: reject invalid regions | checked_regions; server edit payload gate | Bounds, bool/float, count and stale-job tests | One applied set per load, maximum 32 rectangles |
| R05: no stale edit result | server.py current job, invalidation and TTL | test_redaction_replaces_job_and_rejects_stale_export; browser checks | Pending UI edits are not a server-side review record |
| R06: disclose actual assessment | report schema 2; UI wording | Report tests; browser acknowledgement/reset checks | No Clean Pixel Data or complete anonymity claim |
| R07: bind report to saved bytes | output_sha256 | Download digest/reopen verification | A digest identifies an artifact, not its privacy safety |
| R08: repeatable privacy fixtures | fixtures.py; scripts/reproduce.py | Synthetic and fake-text checksums, semantic report digest | Random output UIDs deliberately prevent identical full DICOM bytes |
| R09: local processing | Host/Origin/token checks, explicit assets | Server tests; browser network denied outside loopback | Not designed as a hosted or multi-user service |

## Risk register

| Risk | Priority | Mitigation / evidence | Remaining decision |
| --- | --- | --- | --- |
| Text outside user rectangles survives | High | Explicit selected-region-only wording and fake-text exercise | Evaluated detector plus human review, A041-A048 |
| Recognisable anatomy survives | High | Kept unassessed; no defacing claims | Full-volume privacy/utility study, A049-A056 |
| Required MR fields removed | High | Explicit custom-policy / no IOD claim | External baseline and coded-field repair, A065-A067 |
| Unknown flag values treated as clean | High | No clean-status marker; positive declarations remain rejected | Quarantined review workflow, A032 |
| Wrong coordinates erase useful anatomy | High | Source-coordinate validation, pending outlines, post-write outside-mask checks | Human selection remains fallible; no diagnostic use |
| Verification shares parser with writer | Medium | Separate algorithm and mutation tests | Add external IOD/parser cross-check, A065-A066 |
| Source data links to output | High for public real-data release | No source hash or mapping in reports; fresh identifiers | Recipient-context risk assessment, A055-A056 |
| Local storage/memory exposes data | Medium | No upload spooling, fixed errors, TTL | OS memory is not securely erased; downloads are user-controlled |
| Dependency or policy drift | Medium | Locked versions, CI | Pin action revisions, SBOM, provenance and vulnerability checks, A092-A094 |
| Claims exceed validation | High | This matrix, versioned report, explicit limits | External imaging/privacy review before institutional use, A096 |

## Release gate for this increment

Require passing Python and pixel tests, static checks, reproducibility generation, packaged assets, and browser checks of actual redacted downloads, acknowledgement reset, stale jobs and narrow layouts. Keep known limits above visible in README and reports. Do not claim that these gates are sufficient for real-patient publication or full DICOM validity.
