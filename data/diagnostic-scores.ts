import type { CaseId, ScoreFixture } from "@/types/competition";

export const SCORE_DISCLAIMER = "Illustrative Diagnostic Support Score — Not Clinically Validated";

export const DIAGNOSTIC_SUPPORT_SCORES: Record<CaseId, ScoreFixture[]> = {
  "case-01": [
    { label: "Obstructive sialolithiasis", score: 88, rationale: "Fixture combines meal-related symptoms with a shadowing intraductal focus and ductal dilatation." },
    { label: "Associated sialodochitis / stricture", score: 64, rationale: "The configured ductal study adds narrowing and inflammatory ductal change; this score is not a probability." },
    { label: "Non-calculous stenosis", score: 24, rationale: "A stricture can contribute, but the stone fixture provides a stronger explanatory finding." },
  ],
  "case-02": [
    { label: "Acute parotitis / sialadenitis", score: 86, rationale: "Acute unilateral pain, erythema, four-day duration, and fixture Doppler hypervascularity are concordant." },
    { label: "Autoimmune-related glandular disease", score: 22, rationale: "Hypoechoic areas overlap, but absent sicca symptoms and a normal contralateral comparison make this less favored." },
    { label: "Other infectious or inflammatory cause", score: 38, rationale: "The imaging pattern is inflammatory but not organism-specific." },
  ],
  "case-03": [
    { label: "Sjögren-related involvement", score: 68, rationale: "Sicca symptoms and configured peripheral punctate sialectasis are supportive despite no definite ultrasound parenchymal abnormality." },
    { label: "Other chronic inflammatory sialadenitis", score: 41, rationale: "Peripheral punctate change is not exclusive to Sjögren syndrome and requires clinical correlation." },
    { label: "Juvenile/recurrent inflammatory parotitis pattern", score: 18, rationale: "Included as an imaging differential; the adult clinical fixture is less supportive." },
  ],
  "case-04": [
    { label: "Noncalcified intraductal obstruction", score: 79, rationale: "A negative scout with a configured distal filling defect and upstream chronic ductal change supports non-radiopaque obstruction." },
    { label: "Mucous plug", score: 58, rationale: "Mucous material remains a plausible cause of a noncalcified filling defect and cannot be separated without verification." },
    { label: "Primary inflammatory stricture", score: 46, rationale: "Focal stenosis and sialodochitis-type changes may contribute independently to the obstructive pattern." },
  ],
  "case-05": [
    { label: "Focal space-occupying process", score: 76, rationale: "Regional underfilling with ductal splaying and displacement supports mass effect but does not define histology." },
    { label: "Chronic sclerosing / IgG4-related sialadenitis", score: 42, rationale: "Inflammatory pseudotumoral disease remains a clinically dependent differential for a firm submandibular process." },
    { label: "Salivary neoplasm", score: 54, rationale: "A neoplasm requires targeted imaging and tissue characterization; the educational score is not a probability." },
  ],
};
