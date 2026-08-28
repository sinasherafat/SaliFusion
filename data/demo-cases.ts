import type { DemoCase } from "@/types/salifusion";

export const DEMO_CASES: DemoCase[] = [
  {
    id: "space-occupying-lesion",
    title: "Case 1 — Space-Occupying Lesion",
    shortTitle: "Space-Occupying Lesion",
    modality: "multimodal",
    message: "Sialography demonstrates ductal displacement while ultrasound characterizes the lesion as solid.",
    assets: [
      { modality: "sialography_2d", src: "/demo-cases/ball-in-hand-sialography.jpg", alt: "Sialography showing ball-in-hand ductal displacement" },
      { modality: "ultrasound", src: "/demo-cases/tumor-ultrasound.jpg", alt: "Ultrasound demonstrating a well-defined solid salivary lesion" },
    ],
    result: {
      caseId: "space-occupying-lesion", modality: "multimodal", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Ductal displacement with ball-in-hand appearance", "Well-defined solid lesion on ultrasound"],
      assessment: "Space-occupying salivary gland lesion",
      differentials: ["Benign salivary gland tumor pattern, such as pleomorphic adenoma", "Other solid salivary lesion"],
      supportingFeatures: ["Sialographic mass effect", "Solid rather than cystic ultrasound morphology"],
      complementaryFindings: ["Ultrasound adds lesion composition to the ductal displacement pattern"],
      conflictingFindings: [], confidence: "High", concordance: "High Concordance", demoOnly: true,
    },
  },
  {
    id: "sialolith-sialography",
    title: "Case 2 — Sialolithiasis: Sialography-Dominant",
    shortTitle: "Sialography-Dominant Stone",
    modality: "sialography_2d",
    message: "A ductal obstruction pattern demonstrates the value of sialography when a calculus is poorly conspicuous elsewhere.",
    assets: [{ modality: "sialography_2d", src: "/demo-cases/sialolith-sialography.jpg", alt: "Sialography showing obstructive ductal abnormality" }],
    result: {
      caseId: "sialolith-sialography", modality: "sialography_2d", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Ductal filling abnormality", "Obstruction with proximal ductal dilatation", "Secondary sialectatic and inflammatory change"],
      assessment: "Sialolithiasis with obstructive changes and secondary sialadenitis",
      differentials: ["Ductal stricture"], supportingFeatures: ["Abrupt filling abnormality", "Upstream ductal dilatation"],
      confidence: "High", concordance: null, recommendation: "Sialography is highly informative in this demonstration case.", demoOnly: true,
    },
  },
  {
    id: "sialolith-ultrasound",
    title: "Case 3 — Sialolithiasis: Ultrasound Sufficient",
    shortTitle: "Ultrasound-Sufficient Stone",
    modality: "ultrasound",
    message: "Ultrasound demonstrates a distal calculus with shadowing; additional sialography is not required in this case.",
    assets: [{ modality: "ultrasound", src: "/demo-cases/sialolith-ultrasound.jpg", alt: "Ultrasound showing a distal salivary calculus" }],
    result: {
      caseId: "sialolith-ultrasound", modality: "ultrasound", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Hyperechoic focus", "Posterior acoustic shadowing", "Adjacent ductal dilatation"],
      assessment: "Distal sialolithiasis", differentials: ["Calcified ductal debris"],
      supportingFeatures: ["Echogenic focus with clean posterior shadow", "Dilated adjacent duct"],
      confidence: "High", concordance: null, recommendation: "Ultrasound findings are sufficient; additional sialography is not required for this demonstration case.", demoOnly: true,
    },
  },
  {
    id: "sjogren-ultrasound",
    title: "Case 4 — Sjögren Pattern on Ultrasound",
    shortTitle: "Sjögren Ultrasound Pattern",
    modality: "ultrasound",
    message: "Heterogeneous glandular parenchyma with multiple hypoechoic areas.",
    assets: [{ modality: "ultrasound", src: "/demo-cases/sjogren-ultrasound.jpg", alt: "Ultrasound showing heterogeneous salivary gland parenchyma" }],
    result: {
      caseId: "sjogren-ultrasound", modality: "ultrasound", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Heterogeneous glandular parenchyma", "Multiple hypoechoic areas"],
      assessment: "Sjögren-related glandular pattern", differentials: ["Chronic inflammatory sialadenitis"],
      supportingFeatures: ["Diffuse parenchymal heterogeneity", "Scattered hypoechoic foci"],
      confidence: "Moderate", concordance: null, demoOnly: true,
    },
  },
  {
    id: "sjogren-2d",
    title: "Case 5 — Early Sjögren Pattern on 2D Sialography",
    shortTitle: "Early Sjögren 2D Pattern",
    modality: "sialography_2d",
    message: "An informative ductal/sialectatic pattern compatible with early Sjögren-related ductal involvement.",
    assets: [{ modality: "sialography_2d", src: "/demo-cases/sjogren-2d-sialography.jpg", alt: "Sialography showing a Sjögren-related ductal pattern" }],
    result: {
      caseId: "sjogren-2d", modality: "sialography_2d", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Sialectatic ductal changes", "Reduced peripheral branching"],
      assessment: "Early Sjögren-related sialographic pattern", differentials: ["Chronic inflammatory sialadenitis"],
      supportingFeatures: ["Peripheral punctate sialectatic pattern"], confidence: "High", concordance: null,
      recommendation: "Correlate with clinical findings; this demo does not make universal claims about biopsy or ultrasound.", demoOnly: true,
    },
  },
  {
    id: "sjogren-cbct",
    title: "Case 6 — Sjögren on 3D / CBCT Sialography",
    shortTitle: "Sjögren 3D Ductal Pattern",
    modality: "cbct_3d",
    message: "The supplied image is a curated reference; real DICOM-series import and MPR are demonstrated separately in the CBCT workspace.",
    assets: [{ modality: "cbct_3d", src: "/demo-cases/sjogren-cbct-reference.jpg", alt: "Curated reference montage of three-dimensional sialography" }],
    result: {
      caseId: "sjogren-cbct", modality: "cbct_3d", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Three-dimensional peripheral ductal irregularity", "Multifocal sialectatic involvement"],
      assessment: "Sjögren-related three-dimensional ductal involvement", differentials: ["Chronic inflammatory sialadenitis"],
      supportingFeatures: ["Diffuse three-dimensional ductal pattern"], confidence: "Moderate", concordance: null,
      recommendation: "Curated visual reference only; the prototype does not include a trained volumetric AI model.", demoOnly: true,
    },
  },
];

export function getDemoCase(caseId: string) {
  return DEMO_CASES.find((item) => item.id === caseId) ?? null;
}
