import type { DemoAsset, DemoCase, Modality } from "@/types/salifusion";

export const DEMO_CASES: DemoCase[] = [
  {
    id: "space-occupying-lesion",
    title: "Case 1 — Space-Occupying Lesion",
    shortTitle: "Ball-in-hand lesion",
    modality: "sialography_2d",
    message: "Begin with the ball-in-hand sialogram, then add ultrasound to characterize the lesion automatically.",
    assets: [
      { modality: "sialography_2d", src: "/demo-cases/ball-in-hand-sialography.jpg", alt: "Sialography showing ball-in-hand ductal displacement" },
      { modality: "ultrasound", src: "/demo-cases/tumor-ultrasound.jpg", alt: "Ultrasound demonstrating a well-defined solid salivary lesion" },
    ],
    result: {
      caseId: "space-occupying-lesion", modality: "sialography_2d", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Ductal displacement with ball-in-hand appearance", "Localized mass effect on the salivary ductal system"],
      assessment: "Space-occupying salivary gland lesion with sialographic mass effect",
      differentials: ["Benign salivary gland tumor", "Salivary cyst"],
      supportingFeatures: ["Ball-in-hand ductal displacement pattern", "Preserved surrounding ductal opacification"],
      confidence: "Moderate", concordance: null,
      additionalImagingRecommendation: "Ultrasound is recommended for lesion characterization and differentiation of solid versus cystic composition.",
      recommendedNextModality: "ultrasound", demoOnly: true,
    },
    modalityResults: {
      ultrasound: {
        caseId: "space-occupying-lesion", modality: "ultrasound", isCuratedDemoCase: true, imageQuality: "Adequate",
        findings: ["Well-defined solid salivary lesion", "Predominantly hypoechoic internal echotexture", "Benign-appearing circumscribed margin"],
        assessment: "Solid salivary gland lesion with benign-appearing ultrasound features",
        differentials: ["Pleomorphic adenoma", "Other benign solid salivary lesion"],
        supportingFeatures: ["Solid rather than cystic morphology", "Well-defined margin"],
        confidence: "Moderate", concordance: null,
        additionalImagingRecommendation: "No additional imaging is required for this curated combined demonstration after correlation with the sialogram.",
        demoOnly: true,
      },
    },
    fusionResult: {
      caseId: "space-occupying-lesion", modality: "multimodal", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Sialography demonstrates ball-in-hand ductal displacement", "Ultrasound demonstrates a well-defined solid lesion"],
      assessment: "Space-occupying salivary gland lesion with a benign-appearing solid tumor differential",
      differentials: ["Pleomorphic adenoma", "Other benign solid salivary lesion"],
      supportingFeatures: ["Concordant sialographic mass effect", "Solid rather than cystic ultrasound morphology"],
      complementaryFindings: ["Ultrasound adds tissue composition to the sialographic localization pattern"],
      conflictingFindings: [], confidence: "High", concordance: "High Concordance",
      additionalImagingRecommendation: "No further modality is required in this curated demonstration after integrated sialography and ultrasound review.",
      demoOnly: true,
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
      confidence: "High", concordance: null,
      additionalImagingRecommendation: "No additional imaging is required in this demonstration; ultrasound may be added if direct calculus localization is clinically desired.",
      demoOnly: true,
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
      confidence: "High", concordance: null,
      additionalImagingRecommendation: "No additional imaging is required; ultrasound findings are sufficient for this demonstration case.",
      demoOnly: true,
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
      confidence: "Moderate", concordance: null,
      additionalImagingRecommendation: "A ductal modality such as 2D sialography may provide complementary information if clinically desired.",
      recommendedNextModality: "sialography_2d", demoOnly: true,
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
      additionalImagingRecommendation: "Additional imaging may not be necessary based on the current demonstration case.",
      demoOnly: true,
    },
  },
  {
    id: "sjogren-cbct",
    title: "Case 6 — Sjögren on 3D / CBCT Sialography",
    shortTitle: "Sjögren 3D Ductal Pattern",
    modality: "cbct_3d",
    message: "The supplied image is a curated reference; real DICOM-series import and MPR remain available in the CBCT workspace.",
    assets: [{ modality: "cbct_3d", src: "/demo-cases/sjogren-cbct-reference.jpg", alt: "Curated reference montage of three-dimensional sialography" }],
    result: {
      caseId: "sjogren-cbct", modality: "cbct_3d", isCuratedDemoCase: true, imageQuality: "Adequate",
      findings: ["Three-dimensional peripheral ductal irregularity", "Multifocal sialectatic involvement"],
      assessment: "Sjögren-related three-dimensional ductal involvement", differentials: ["Chronic inflammatory sialadenitis"],
      supportingFeatures: ["Diffuse three-dimensional ductal pattern"], confidence: "Moderate", concordance: null,
      additionalImagingRecommendation: "No additional modality is required in this demonstration case.",
      demoOnly: true,
    },
  },
];

export function getDemoCase(caseId: string) {
  return DEMO_CASES.find((item) => item.id === caseId) ?? null;
}

export function getDemoResult(demoCase: DemoCase, modality: Modality) {
  if (demoCase.result.modality === modality) return demoCase.result;
  return demoCase.modalityResults?.[modality] ?? null;
}

export function findCuratedAsset(fileName: string, modality: Modality): { demoCase: DemoCase; asset: DemoAsset } | null {
  const normalized = fileName.trim().toLowerCase();
  for (const demoCase of DEMO_CASES) {
    const asset = demoCase.assets.find((item) => item.modality === modality && item.src.split("/").at(-1)?.toLowerCase() === normalized);
    if (asset) return { demoCase, asset };
  }
  return null;
}

export function curatedAssetsForModality(modality: Modality) {
  return DEMO_CASES.flatMap((demoCase) => demoCase.assets.filter((asset) => asset.modality === modality).map((asset) => ({ demoCase, asset })));
}
