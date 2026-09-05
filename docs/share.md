# Share the first version

Repository: https://github.com/zakimaths/dicom-deid-workbench

Use the synthetic screenshot in `docs/screenshot.png`. It contains no patient data. These are drafts for you to post; they are not published automatically.

## LinkedIn

I built a small DICOM Workbench: a local metadata scrubber and 2D medical-image viewer, with a straightforward macOS setup.

It generates a synthetic CT phantom, shows which metadata fields changed, lets you adjust window/level, and exports a new DICOM without changing its pixels. The Python core also runs from the command line and has repeatable tests.

The biggest lesson: removing metadata is not the same as anonymising an image. This is an educational prototype with a deliberately narrow support matrix; it does not assess identifying text or anatomy in pixels.

Code and setup: https://github.com/zakimaths/dicom-deid-workbench

## X

Built a local DICOM Workbench: metadata scrubbing, window/level viewing and a synthetic CT demo. Small Python setup, repeatable tests. Educational only: pixels aren't assessed for identity.

https://github.com/zakimaths/dicom-deid-workbench
