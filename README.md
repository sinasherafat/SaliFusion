# SaliFusion

Competition-ready educational demonstration of an equipment-integrated clinical imaging workstation for salivary gland and ductal disorders.

## What is implemented

- Independent ultrasound, conventional 2D sialography, and 3D CBCT sialography workspaces.
- Local DICOM parsing, series grouping, Cornerstone stack review, and genuine axial/coronal/sagittal MPR for spatially valid CBCT DICOM series.
- Local JPG/PNG review with preserved aspect ratio and explicit unsupported-format states.
- Simulated live ultrasound replay, always labeled as prerecorded/simulated.
- Four-phase 2D sialography model with partial-phase analysis and explicit missing-evidence statements.
- Structured clinical history, conditional autoimmune/medication/contrast fields, and safety screening.
- Explainable recommendation rules that distinguish preferred, optional, and currently inappropriate examinations.
- Automatic multimodal fusion only when patient ID, gland, and laterality match.
- Eight deterministic educational cases, including ultrasound-negative obstruction and acute-infection safety-stop scenarios.
- Structured clinician-review report with browser printing and direct PDF download.
- Competition Demo walkthrough for the high-impact occult-obstruction story.

## Important boundaries

This is an educational deterministic demonstration, not a trained or clinically validated diagnostic model. Confidence labels are qualitative and explicitly unvalidated. Arbitrary uploaded studies can be viewed but do not receive fabricated diagnostic output.

The packaged JPG references were supplied with the project and retain source-permission warnings. New SVG assets are explicitly labeled synthetic educational schematics. The CBCT reference image is not presented as a reconstructed volume; true MPR activates only for compatible spatial DICOM data.

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

The automated tests cover independent modality services, missing sialography phases, acute-infection contraindication handling, Sjögren and Kussmaul recommendation logic, identity/laterality-gated fusion, PDF generation, and browser workflows.

## Deployment

`vercel.json` retains the Git-backed Next.js preview configuration. Deploy this feature branch as a non-production preview; do not promote it to production without clinical, security, licensing, and regulatory review.
