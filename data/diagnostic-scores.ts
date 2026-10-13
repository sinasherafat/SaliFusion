import type { CaseId, ScoreFixture } from "@/types/competition";

export const SCORE_DISCLAIMER = "Educational Demonstration Only — Scores Are Illustrative and Not Clinically Validated.";

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
    { label: "Sjögren-related involvement", score: 72, rationale: "Sicca symptoms, episodic bilateral swelling, mild heterogeneity, and configured punctate sialectasis are supportive together." },
    { label: "Other chronic inflammatory sialadenitis", score: 43, rationale: "The subtle ultrasound and punctate pattern are not exclusive to Sjögren syndrome." },
    { label: "Juvenile/recurrent inflammatory parotitis pattern", score: 18, rationale: "Included as an imaging differential; the adult clinical fixture is less supportive." },
  ],
};
