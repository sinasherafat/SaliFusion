# SaliFusion AI

SaliFusion AI is a functional medical-imaging proof of concept for a competition demonstration of multimodal salivary-gland assessment. It presents a linear patient → modality → import/review → analysis → clinician-report workflow while clearly separating real image-handling features from simulated diagnostic output.

This repository is a research and competition prototype. It is not a medical device and must not be used for clinical diagnosis or patient care.

## What is functional

- Six curated demonstration cases spanning ultrasound, 2D sialography, CBCT, and multimodal workflows.
- Local import of DICOM Part 10 files and JPG/PNG images.
- Browser-side DICOM parsing, metadata display, understandable import errors, and grouping by Series Instance UID.
- Sequential stack navigation and multiple-series selection.
- Spatial slice sorting from Image Position (Patient) and Image Orientation (Patient), with Instance Number fallback identified as unsuitable for reliable MPR.
- Cornerstone3D stack rendering and real streaming-volume creation for spatially valid CBCT series.
- Axial, coronal, and sagittal orthographic MPR with window/level, zoom, pan, reset, and slice navigation.
- Current-view image export.
- Concordance and discordance presentation across modalities.
- Structured clinician report with Accept, Modify, Reject, notes, and browser print/Save-as-PDF support.
- A modular analysis-service contract designed for later replacement by trained models.

## What is simulated

Diagnostic inference, confidence language, differentials, supporting features, and cross-modal interpretation are pre-authored demonstration outputs for the six curated cases only. They are not produced by a trained model and are labeled as simulated in the interface and report.

Arbitrary uploads remain viewable, but the application deliberately blocks disease inference for them. This safeguard prevents the prototype from fabricating a diagnosis for unrecognized user-provided images.

## Supported inputs

- Single-frame DICOM ultrasound or 2D sialography images.
- Sequential DICOM stacks.
- Spatially valid CBCT DICOM series suitable for volume construction and MPR.
- JPG and PNG images as a non-DICOM review pathway.

Browser-compatible transfer syntax support is provided by `@cornerstonejs/dicom-image-loader`. Malformed, unsupported, non-image, or spatially incomplete instances are reported rather than silently treated as valid CBCT volumes.

## DICOM and CBCT architecture

- `lib/dicom`: local parsing, metadata extraction, series grouping, and geometry-based spatial sorting.
- `lib/cornerstone`: lazy browser-only initialization of Cornerstone3D, the DICOM image loader, tools, and cache cleanup.
- `components/viewers`: isolated Cornerstone stack/MPR viewers plus the JPG/PNG fallback viewer.
- `data/demo-cases.ts`: the six curated case definitions and their packaged image assets.
- `services/analysis.ts`: ultrasound, sialography, and multimodal analysis-service interfaces.
- `services/fusion-service.ts`: concordance/discordance behavior.
- `services/report-service.ts`: structured report creation and clinician review state.
- `types/salifusion.ts`: shared UI and service contracts.

For CBCT, the app registers local instances with Cornerstone, verifies spatial geometry, creates a real streaming volume, and attaches orthographic axial, coronal, and sagittal viewports to that volume. A series missing reliable spatial metadata is not represented as dependable MPR.

## Local setup

Requirements: Node.js 22.13 or newer and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.

## Testing and production build

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Browser acceptance tests:

```bash
pnpm exec playwright install chrome
pnpm test:e2e
```

The production command is `pnpm start` after a successful `pnpm build`. The included `vercel.json` uses the frozen lockfile and the Next.js Webpack build.

## Privacy behavior

Imported files are processed locally in the browser and are not uploaded by this application. DICOM metadata is read only for display, grouping, and spatial ordering. Starting a new study purges object URLs, the local file manager, and the Cornerstone cache.

Use only fictional or properly de-identified data. The prototype has no accounts, server-side study store, PACS/RIS integration, telemetry pipeline, or cloud DICOM persistence. No `.env` file or credential is required for the demonstrated workflow.

## Known limitations

- No trained diagnostic model, validated performance claim, segmentation, PACS/RIS, cine ultrasound, or cloud DICOM storage.
- No anatomical DICOM series is distributed in this repository; CBCT MPR should be exercised with a compatible de-identified local series.
- 3D volume rendering is intentionally out of scope; the prototype prioritizes real orthographic MPR.
- Very large studies can make first volume construction memory-intensive. Production use should add study-size limits and deeper transfer-syntax validation.
- Print/PDF output uses the browser print dialog rather than a server-generated signed clinical document.
- Packaged demonstration images retain their supplied annotations. Their inclusion is not a copyright-clearance claim; public use still requires appropriate permission or licensing.

## Future trained-AI integration

A future inference adapter can implement the existing `AnalysisService` contract and return the established `AnalysisResult` shape. That allows a validated local or remote model to replace the curated simulator without redesigning image import, visualization, fusion, review, or reporting. A production integration must add model/version provenance, validation, access control, audit logging, privacy review, and failure-safe behavior before any clinical evaluation.
