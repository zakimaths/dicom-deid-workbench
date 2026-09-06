# NIfTI workspace

Mode: Operate. Audience: students exploring 3D scans and authorised local reviewers.
The surface inherits the **Arcade Terminal** palette, fonts, bordered panels and labelled native controls from `DESIGN.md`. Its purpose is to make a volume and its proposed changes inspectable one slice at a time. This is an extension of the established workspace; its local layout choices do not change the global design system.

## Reading and interaction order

The sequence is **open, explore, compare, review, save**. Sample actions lead to one large labelled scan plane beside direction and slice controls. Comparison choices sit above the scan; local preparation, review and downloads sit below. The scan and controls stack on narrower screens. Existing semantic colours distinguish information and caution, with their meaning also written out.

The viewer offers axial, coronal and sagittal directions, a slice slider, previous/next buttons, contrast and 50–300% zoom. A disclosure contains horizontal and vertical pan controls for inspecting enlarged image edges. **Fit whole slice** centres the picture and resets zoom; **Reset view** also restores the middle slice and contrast. Viewing controls never change saved voxels. Direction labels refer to the person in the scan and have accompanying explanatory text.

Comparison switches the same large plane between **Original anatomy**, **After removal**, **Removal area** and **Supplied brain mask**. Slice position, direction, zoom and pan stay linked. Before/after anatomy shares contrast; binary mask views use their own display range. Written counts distinguish changed voxels, changes inside the supplied mask and changes outside the selected region. **Inspect comparison** returns keyboard focus from local review to the picture selector.

## Public and local workflows

Public `/nifti.html` contains curated teaching volumes and a prepared MNI average-head comparison. It accepts no uploads and does not compute a removal proposal. The average head is one template, not a patient validation cohort; some supplied atlas face-region voxels remain outside its removal area.

Local `/nifti` additionally opens supported scalar 3D NIfTI-1 files. Header cleaning remains a separate operation: create a fresh `.nii`, verify header and voxel preservation, acknowledge its limits and the loss of extensions, then save the new file and report.

Experimental face-region removal requires a structural brain MRI and a separately reviewed binary brain mask on the same grid. For an uploaded mask, the user must first inspect its full coverage against the MRI in an appropriate segmentation viewer. Loading it here is not anatomical validation. The user chooses a 2–20 mm protection margin, acknowledges the input review and prepares a proposal. The program reopens the output to check zeroed selected voxels, unchanged surrounding voxels and unchanged supplied-mask values.

After inspecting the comparison in all three directions, the user must be viewing **After removal** and acknowledge the review before downloading the new proposal, binary removal map and report. Changing the source, mask, margin or mask-review acknowledgement invalidates the previous proposal and its review tick. Obsolete responses cannot enable downloads. Clear, page exit and ten minutes of inactivity release browser references; this does not guarantee memory erasure.

## Boundaries and accessibility

The removal profile requires axis-aligned, non-negative, unscaled structural MRI and matching mask geometry. It does not create a brain segmentation, resample an oblique scan or establish anatomical privacy. Preserving a supplied mask does not prove that all brain tissue was protected. Remaining facial anatomy and possible tissue loss need independent assessment. Exact format constraints, method, example measurements and reproducible checks belong in [NIfTI removal documentation](nifti-defacing.md) and [NIfTI input documentation](nifti.md).

Exploration and review use labelled keyboard-accessible controls, visible focus, written status and explanatory help. The canvas is a visual view rather than an exclusive gesture control. Automated browser checks do not replace physical-device or assistive-technology validation, which remain outstanding. There is no automatic segmentation, diagnostic approval or anonymity certification.
