import dicomParser from "dicom-parser";
import type { DicomMetadata, DicomSeries, ParsedDicomFile } from "@/types/salifusion";

const numberList = (value?: string) => value?.split("\\").map(Number).filter(Number.isFinite) ?? [];
const optionalNumber = (value?: string) => value === undefined || value === "" ? undefined : Number(value);

function spatialPosition(position?: number[], orientation?: number[]) {
  if (!position || position.length !== 3 || !orientation || orientation.length !== 6) return undefined;
  const [rx, ry, rz, cx, cy, cz] = orientation;
  const normal = [ry * cz - rz * cy, rz * cx - rx * cz, rx * cy - ry * cx];
  return position[0] * normal[0] + position[1] * normal[1] + position[2] * normal[2];
}

export async function parseDicomFile(file: File): Promise<ParsedDicomFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let dataSet: dicomParser.DataSet;
  try {
    dataSet = dicomParser.parseDicom(bytes, { untilTag: "x7fe00010" });
  } catch (error) {
    throw new Error(`${file.name}: corrupt or unsupported DICOM (${error instanceof Error ? error.message : "parse failure"}).`);
  }

  const position = numberList(dataSet.string("x00200032"));
  const orientation = numberList(dataSet.string("x00200037"));
  const spacing = numberList(dataSet.string("x00280030"));
  const calculatedPosition = spatialPosition(position, orientation);
  const seriesInstanceUID = dataSet.string("x0020000e")?.trim() || "unknown-series";
  const metadata: DicomMetadata = {
    fileName: file.name,
    patientId: dataSet.string("x00100020")?.trim(), patientName: dataSet.string("x00100010")?.trim(),
    studyDate: dataSet.string("x00080020")?.trim(), studyInstanceUID: dataSet.string("x0020000d")?.trim(),
    seriesInstanceUID, seriesDescription: dataSet.string("x0008103e")?.trim(), modality: dataSet.string("x00080060")?.trim(),
    instanceNumber: optionalNumber(dataSet.string("x00200013")), sliceLocation: optionalNumber(dataSet.string("x00201041")),
    sliceThickness: optionalNumber(dataSet.string("x00180050")), rows: dataSet.uint16("x00280010"), columns: dataSet.uint16("x00280011"),
    transferSyntax: dataSet.string("x00020010")?.trim(),
    imagePosition: position.length === 3 ? position as [number, number, number] : undefined,
    imageOrientation: orientation.length === 6 ? orientation as [number, number, number, number, number, number] : undefined,
    pixelSpacing: spacing.length >= 2 ? [spacing[0], spacing[1]] : undefined,
    spatialPosition: calculatedPosition, spatiallySorted: calculatedPosition !== undefined,
  };
  return { file, metadata };
}

export async function groupDicomSeries(files: File[], onProgress?: (completed: number, total: number) => void): Promise<DicomSeries[]> {
  if (files.length === 0) throw new Error("The selected folder is empty.");
  const parsed: ParsedDicomFile[] = [];
  const errors: string[] = [];
  for (let index = 0; index < files.length; index += 1) {
    try { parsed.push(await parseDicomFile(files[index])); }
    catch (error) { errors.push(error instanceof Error ? error.message : `${files[index].name}: parse failure.`); }
    onProgress?.(index + 1, files.length);
  }
  if (parsed.length === 0) throw new Error(errors[0] ?? "No readable DICOM instances were found.");

  const grouped = new Map<string, ParsedDicomFile[]>();
  for (const item of parsed) grouped.set(item.metadata.seriesInstanceUID, [...(grouped.get(item.metadata.seriesInstanceUID) ?? []), item]);

  return [...grouped.entries()].map(([uid, instances]) => {
    const hasSpatial = instances.every((item) => item.metadata.spatialPosition !== undefined);
    const sorted = [...instances].sort((left, right) => hasSpatial
      ? (left.metadata.spatialPosition ?? 0) - (right.metadata.spatialPosition ?? 0)
      : (left.metadata.instanceNumber ?? 0) - (right.metadata.instanceNumber ?? 0));
    sorted.forEach((item) => { item.metadata.spatiallySorted = hasSpatial; });
    const first = sorted[0].metadata;
    return {
      uid, description: first.seriesDescription || `Series ${uid.slice(-8)}`, modality: first.modality || "Unknown",
      instances: sorted, spatiallySorted: hasSpatial,
      warning: hasSpatial ? undefined : "Spatial position/orientation metadata is incomplete. Instance Number fallback was used; volume creation may be invalid.",
    };
  }).sort((a, b) => b.instances.length - a.instances.length);
}
