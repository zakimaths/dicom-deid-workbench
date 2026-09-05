# Research recommendations: implementation status

The 0.3.0 work incorporates the research into working features, checks and explicit follow-up requirements.

| Recommendation | Delivered | Remaining evidence or scope |
| --- | --- | --- |
| Meaningful NONYMISE challenges | Seeded locations/styles/rotations/contrast, blank and innocent controls, assisted reveal | More fonts, languages and institution-specific layouts with independent annotations |
| Independent scoring | Saved-PNG reopen, identifier misses, changed non-label pixels, innocent-label damage, failure controls | Independent clinical ground truth for unfamiliar source labels |
| DICOM validity | Strict required acquisition codes, Type 2 handling, rule matrix, pinned external validator and negative control | Full selected IOD/profile review; validator is a fixture gate, not runtime certification |
| Related files | Bounded single-study UID continuity, duplicate/mixed-study/reference rejection | Reference-bearing datasets, broader study semantics and use-case-specific date shifting |
| OCR review | Local pinned English worker, editable suggestions, cancellation including startup, unresolved empty/failure states | Real-world sensitivity; second independent detector; multilingual corpus |
| External benchmarks | Local hash-pinned manifest runner with complete acceptance/rejection denominator | MIDI download/licence review and answer-key adapter; external PHI scoring has not run |
| Reproducibility/formality | Versioned reports, pinned assets, contribution/citation/review templates, SBOM and provenance workflow | Successful hosted attestation needs a CI run; clinical/expert review needs real reviewers |
| Learning evidence | Learner-session protocol and review template | Recruited learner pilot, expert anatomy review, consented findings |
| Accessibility | Automated rule scans and keyboard/mobile/reduced-motion flows; disabled-help semantics repaired | Real assistive-technology listening, installed Safari, physical devices and zoom testing |
| Stack restraint | Existing Canvas/Python stack retained | Cornerstone/OHIF only if broader imaging requirements are accepted |
| Volume privacy | Retained as explicit separate research track | No defacing or facial-identifiability claim from a 2D exercise |

No patient data, arbitrary uploads, accounts, cloud OCR, diagnostic AI or hidden tracking were added to the public site. This release does not make the project a clinical anonymisation service.
