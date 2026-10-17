import type { CaseId, DemoMediaSlot, GlandExam, PhaseAsset, SialographyPhase, UploadedAsset } from "@/types/competition";

export const CASE_ONE_ULTRASOUND_PATH = "/demo-cases/case-01/left-submandibular-ultrasound.mp4";
export const CASE_TWO_COMPOSITE_PATH = "/demo-cases/case-02/bilateral-parotid-composite-ultrasound.mp4";
export const CASE_ONE_PHASE_PATHS: Record<SialographyPhase, string> = {
  precontrast: "/demo-cases/case-01/scout.png",
  ductal: "/demo-cases/case-01/ductal-filling.png",
  acinar: "/demo-cases/case-01/acinar-filling.png",
  evacuation: "/demo-cases/case-01/evacuation-5-minutes.png",
};

const caseTwoCompositeId = "case-02-bilateral-parotid-composite-ultrasound";
const caseTwoLegacyIds = ["case-02-left-parotid-bmode-abnormal", "case-02-right-parotid-bmode-normal", "case-02-left-parotid-doppler-abnormal", "case-02-right-parotid-doppler-normal"];

function builtInUpload(id: string, name: string, url: string): UploadedAsset {
  return { id, name, url, kind: "video", objectUrl: false, storage: "built-in", type: "video/mp4" };
}

function builtInPhase(name: string, url: string): PhaseAsset {
  return { name, url, objectUrl: false, storage: "built-in", type: "image/png" };
}

export function builtInMediaForCase(caseId: CaseId): Pick<GlandExam, "ultrasoundUploads" | "phaseUploads"> {
  if (caseId === "case-01") {
    return {
      ultrasoundUploads: { "case-01-left-submandibular-bmode": builtInUpload("case-01-left-submandibular-bmode", "VIDEO 1.mov · Built-in Clinical Demo Media", CASE_ONE_ULTRASOUND_PATH) },
      phaseUploads: {
        precontrast: builtInPhase("CASE 1 1.png · Built-in Clinical Demo Media", CASE_ONE_PHASE_PATHS.precontrast),
        ductal: builtInPhase("CASE 1 2.png · Built-in Clinical Demo Media", CASE_ONE_PHASE_PATHS.ductal),
        acinar: builtInPhase("CASE 1 3.png · Built-in Clinical Demo Media", CASE_ONE_PHASE_PATHS.acinar),
        evacuation: builtInPhase("CASE 1 4.png · Built-in Clinical Demo Media", CASE_ONE_PHASE_PATHS.evacuation),
      },
    };
  }
  if (caseId === "case-02") {
    const composite = builtInUpload(caseTwoCompositeId, "case 2.mov · Built-in Clinical Demo Media", CASE_TWO_COMPOSITE_PATH);
    return { ultrasoundUploads: Object.fromEntries([caseTwoCompositeId, ...caseTwoLegacyIds].map((id) => [id, { ...composite, id }])), phaseUploads: {} };
  }
  return { ultrasoundUploads: {}, phaseUploads: {} };
}

/**
 * Competition ultrasound slots. Cases 1 and 2 use owner-authorized, de-identified
 * built-in demo media; later cases preserve their optional local-import slots.
 */
export const DEMO_MEDIA_SLOTS: DemoMediaSlot[] = [
  { id: "case-01-left-submandibular-bmode", caseId: "case-01", modality: "ultrasound", gland: "submandibular", side: "left", mode: "bmode", label: "Left submandibular · B-mode", mediaUrl: CASE_ONE_ULTRASOUND_PATH, status: "ready" },
  { id: "case-02-bilateral-parotid-composite-ultrasound", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "left", mode: "doppler", label: "Bilateral parotid comparison · B-mode + Doppler", mediaUrl: CASE_TWO_COMPOSITE_PATH, status: "ready", composite: true, sourceRegion: "full" },
  { id: "case-02-left-parotid-bmode-abnormal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "left", mode: "bmode", label: "Left parotid · B-mode", status: "awaiting-upload", sourceRegion: "lower-left" },
  { id: "case-02-right-parotid-bmode-normal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "right", mode: "bmode", label: "Right parotid · B-mode", status: "awaiting-upload", sourceRegion: "upper-left" },
  { id: "case-02-left-parotid-doppler-abnormal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "left", mode: "doppler", label: "Left parotid · Doppler Imaging", status: "awaiting-upload", sourceRegion: "lower-right" },
  { id: "case-02-right-parotid-doppler-normal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "right", mode: "doppler", label: "Right parotid · Doppler Imaging", status: "awaiting-upload", sourceRegion: "upper-right" },
  { id: "case-03-left-parotid-bmode", caseId: "case-03", modality: "ultrasound", gland: "parotid", side: "left", mode: "bmode", label: "Left parotid · B-mode", status: "awaiting-upload" },
  { id: "case-04-provisional-left-submandibular-ultrasound", caseId: "case-04", modality: "ultrasound", gland: "submandibular", side: "left", mode: "bmode", label: "Optional provisional left submandibular · Ultrasound", status: "awaiting-upload" },
  { id: "case-05-right-submandibular-ultrasound", caseId: "case-05", modality: "ultrasound", gland: "submandibular", side: "right", mode: "bmode", label: "Right submandibular · Ultrasound with Doppler", status: "awaiting-upload" },
];

export function mediaSlotsForCase(caseId: DemoMediaSlot["caseId"]) {
  return DEMO_MEDIA_SLOTS.filter((slot) => slot.caseId === caseId);
}
