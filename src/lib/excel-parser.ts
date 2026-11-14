import * as XLSX from "xlsx";
import type { ProspectFinale, ProspectStatus } from "@/lib/types/prospection";

export interface ParsedProspectRow {
  index: number;
  business_name: string;
  wilaya: string;
  commune: string;
  phone: string;
  category: string;
  status: ProspectStatus;
  finale: ProspectFinale;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

export interface ExcelParseResult {
  filename: string;
  totalRows: number;
  validRows: ParsedProspectRow[];
  invalidRows: ParsedProspectRow[];
  duplicateCount: number;
  allRows: ParsedProspectRow[];
}

function cleanPhone(raw: any): string {
  if (!raw) return "";
  const str = String(raw).trim().replace(/[^0-9]/g, "");
  // Format standard algérien : si 9 chiffres commençant par 5, 6 ou 7, préfixer 0
  if (str.length === 9 && (str.startsWith("5") || str.startsWith("6") || str.startsWith("7"))) {
    return "0" + str;
  }
  return str;
}

function normalizeStatus(raw: any): ProspectStatus {
  if (!raw) return "callback";
  const s = String(raw).toLowerCase().trim();
  if (s.includes("essai") || s === "trial") return "trial";
  if (s.includes("refus") || s === "rejected") return "rejected";
  return "callback"; // "À rappeler" par défaut
}

function normalizeFinale(raw: any): ProspectFinale {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  if (s.includes("payé") || s.includes("paye") || s === "paid") return "paid";
  if (s.includes("non") || s === "unpaid") return "unpaid";
  return null;
}

function findColumnValue(row: Record<string, any>, possibleKeys: string[]): any {
  const rowKeys = Object.keys(row);
  for (const target of possibleKeys) {
    const found = rowKeys.find((k) =>
      k
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .includes(
          target
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "")
        )
    );
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
      return row[found];
    }
  }
  return undefined;
}

export async function parseProspectsExcelFile(file: File): Promise<ExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  if (workbook.SheetNames.length === 0) {
    throw new Error("Le classeur Excel ne contient aucune feuille.");
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

  const validRows: ParsedProspectRow[] = [];
  const invalidRows: ParsedProspectRow[] = [];
  const allRows: ParsedProspectRow[] = [];
  const seenPhones = new Set<string>();
  let duplicateCount = 0;

  rawRows.forEach((row, i) => {
    const business_name = String(
      findColumnValue(row, ["nom du prospect", "nom", "prospect", "commerce", "etablissement", "business"]) || ""
    ).trim();

    const wilaya = String(
      findColumnValue(row, ["wilaya", "province", "region"]) || ""
    ).trim();

    const commune = String(
      findColumnValue(row, ["commune", "ville", "secteur", "daira"]) || ""
    ).trim();

    const rawPhone = findColumnValue(row, ["telephone", "tel", "phone", "mobile", "contact"]);
    const phone = cleanPhone(rawPhone);

    const category = String(
      findColumnValue(row, ["activite", "activite", "categorie", "domaine", "metier"]) || "Commerce"
    ).trim();

    const rawStatut = findColumnValue(row, ["statut", "status", "etat"]);
    const status = normalizeStatus(rawStatut);

    const rawFinale = findColumnValue(row, ["finale", "resultat", "paiement", "paye"]);
    const finale = normalizeFinale(rawFinale);

    const errors: string[] = [];
    if (!business_name) errors.push("Nom du prospect manquant");
    if (!phone) errors.push("Numéro de téléphone manquant");
    else if (phone.length < 9) errors.push("Numéro de téléphone incomplet (minimum 9 chiffres)");
    if (!wilaya) errors.push("Wilaya non spécifiée");

    if (phone && seenPhones.has(phone)) {
      duplicateCount++;
      errors.push("Numéro en doublon dans ce fichier");
    } else if (phone) {
      seenPhones.add(phone);
    }

    const parsedRow: ParsedProspectRow = {
      index: i + 1,
      business_name,
      wilaya: wilaya || "Non spécifiée",
      commune: commune || "—",
      phone: phone || String(rawPhone || ""),
      category: category || "Commerce",
      status,
      finale,
      isValid: errors.length === 0,
      errors,
    };

    allRows.push(parsedRow);
    if (parsedRow.isValid) {
      validRows.push(parsedRow);
    } else {
      invalidRows.push(parsedRow);
    }
  });

  return {
    filename: file.name,
    totalRows: rawRows.length,
    validRows,
    invalidRows,
    duplicateCount,
    allRows,
  };
}

