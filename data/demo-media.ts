import type { DemoMediaSlot } from "@/types/competition";

/**
 * The six competition video slots. Add a project-relative mediaUrl and switch
 * status to `ready` when the matching, reviewed educational clip is supplied.
 */
export const DEMO_MEDIA_SLOTS: DemoMediaSlot[] = [
  { id: "case-01-left-submandibular-bmode", caseId: "case-01", modality: "ultrasound", gland: "submandibular", side: "left", mode: "bmode", label: "Left submandibular · B-mode", status: "awaiting-upload" },
  { id: "case-02-left-parotid-bmode-abnormal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "left", mode: "bmode", label: "Affected left parotid · B-mode", status: "awaiting-upload" },
  { id: "case-02-right-parotid-bmode-normal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "right", mode: "bmode", label: "Contralateral right parotid · B-mode", status: "awaiting-upload" },
  { id: "case-02-left-parotid-doppler-abnormal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "left", mode: "color-doppler", label: "Affected left parotid · Color Doppler", status: "awaiting-upload" },
  { id: "case-02-right-parotid-doppler-normal", caseId: "case-02", modality: "ultrasound", gland: "parotid", side: "right", mode: "color-doppler", label: "Contralateral right parotid · Color Doppler", status: "awaiting-upload" },
  { id: "case-03-left-parotid-bmode", caseId: "case-03", modality: "ultrasound", gland: "parotid", side: "left", mode: "bmode", label: "Left parotid · B-mode", status: "awaiting-upload" },
];

export function mediaSlotsForCase(caseId: DemoMediaSlot["caseId"]) {
  return DEMO_MEDIA_SLOTS.filter((slot) => slot.caseId === caseId);
}
