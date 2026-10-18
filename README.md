# SaliFusion

Competition-ready, three-case educational demonstration of an equipment-integrated clinical imaging workflow for salivary gland and ductal disorders.

## What is implemented

- Bright, focused landing and demo-entry experience with an original generated physician-workstation hero.
- Exactly three featured journeys: obstructive sialolithiasis, acute unilateral parotitis, and suspected early Sjögren-related involvement.
- Five persistent stages: History → Imaging → Modality Reports → Fusion → Final Report.
- Thirty core history questions plus conditional contrast and procedural safety follow-ups.
- Independent ultrasound, conventional 2D sialography, and 3D CBCT sialography workspaces.
- Local DICOM parsing, series grouping, Cornerstone stack review, and genuine axial/coronal/sagittal MPR for spatially valid CBCT DICOM series.
- Local JPG/PNG review, explicitly distinguished from true volumetric DICOM.
- Six named ultrasound video slots with local video/image uploads, playback, speed control, and frame capture.
- Four-phase 2D sialography model with partial-phase analysis and explicit missing-evidence statements.
- Explainable green/amber/red pathway rules, including the acute-parotitis contrast-sialography safety stop.
- Fusion only for reviewed modalities on a matching gland and side.
- Independent modality PDFs, fusion PDF, and complete-case PDF.
- Deterministic, case-configured diagnostic support scores that are explicitly illustrative and unvalidated.

## Important boundaries

This is an educational deterministic demonstration, not a trained or clinically validated diagnostic model. Arbitrary uploaded studies can be viewed but do not inherit the preset diagnosis. Scenario findings remain marked as pending image verification until clinician review.

The competition ultrasound manifest intentionally ships with six `awaiting-upload` slots. CBCT screenshots are never presented as reconstructed volumes; true MPR activates only for compatible spatial DICOM data.

No patient files are uploaded by the application. PACS/DICOMweb and vendor SDK connections are future adapter points, not claimed implementations.

## Local development

Requirements: Node.js 22.13+ and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

The automated tests cover the three featured cases, comprehensive history fixtures and editing, six media slots, conditional safety rules, partial sialography phases, CBCT pathway distinctions, identity-gated fusion, illustrative-score disclaimers, all PDF types, and browser workflows.

## Deployment

`vercel.json` retains the Git-backed Next.js preview configuration. Deploy this feature branch as a non-production preview; do not promote it to production without clinical, security, licensing, and regulatory review.
