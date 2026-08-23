import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import {
  findLeadCompanyDuplicateAdmin,
  saveLeadAnalysisAdmin,
  saveLeadCompanyActivityAdmin,
  upsertLeadCompanyAdmin,
} from "@/backend/repos/lead-hunter-repo";
import { getRowValue, qualifyLeadRow } from "@/backend/shared/lead-qualification";
import { resolveReceitaMunicipality } from "@/backend/shared/receita-municipality";
import { buildLeadAnalysisFromCompany } from "@/backend/use-cases/admin/lead-hunter-shared";

const MAX_BATCH_SIZE = 100;

type CsvRow = Record<string, string>;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ";" && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function requiredNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_BATCH_SIZE);
}

function leadLevelFromScore(score: number) {
  if (score >= 70) return "alta";
  if (score >= 40) return "media";
  return "baixa";
}

export async function importLeadBatchUseCase(formData: FormData) {
  await requirePlatformAdmin();

  const file = formData.get("lead_file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Envie um CSV pequeno de leads.");
  }

  const batchSize = requiredNumber(formData.get("batch_size"), 50);
  const batchLabel = String(formData.get("batch_label") ?? "").trim() || `Carga ${new Date().toLocaleDateString("pt-BR")}`;
  const rows = parseCsv(await file.text()).slice(0, batchSize);

  let saved = 0;
  let duplicates = 0;

  for (const row of rows) {
    const qualified = qualifyLeadRow(row);
    const cnpj = qualified.cnpj;
    const phone = qualified.phone;
    const email = qualified.email;
    const businessName = getRowValue(row, "nome_fantasia", "NOME_FANTASIA", "razao_social", "RAZAO_SOCIAL") || cnpj || "Lead sem nome fantasia";
    const address = getRowValue(row, "endereco", "LOGRADOURO") || null;
    const state = getRowValue(row, "uf", "UF") || null;
    const municipalityCode = getRowValue(row, "municipio_codigo", "MUNICIPIO") || null;
    const resolvedMunicipality = resolveReceitaMunicipality({
      code: municipalityCode,
      state,
    });
    const city = resolvedMunicipality?.city ?? municipalityCode ?? null;

    const duplicate = await findLeadCompanyDuplicateAdmin({
      cnpj,
      businessName,
      phone,
      address,
      city,
    });

    const analysis = buildLeadAnalysisFromCompany({
      phone,
      rawData: row,
    });
    const opportunityScore = Math.max(analysis.opportunityScore, qualified.leadScore);

    const result = await upsertLeadCompanyAdmin({
      existingId: duplicate?.id ?? null,
      cnpj,
      businessName,
      businessType: qualified.cnaePrincipal || "CNAE alvo",
      email,
      cnaePrincipal: qualified.cnaePrincipal,
      cnaeSecundaria: qualified.cnaeSecundaria,
      aberturaDate: qualified.aberturaDate,
      contatoQuality: getRowValue(row, "qualidade_contato") || qualified.contatoQuality,
      contactRiskLevel: getRowValue(row, "contact_risk_level") || qualified.contactRiskLevel,
      contactRoleHint: getRowValue(row, "contact_role_hint") || qualified.contactRoleHint,
      contactEvidence: getRowValue(row, "contact_evidence") || qualified.contactEvidence,
      recommendedChannel: getRowValue(row, "recommended_channel") || qualified.recommendedChannel,
      importBatchLabel: batchLabel,
      phone,
      address,
      city,
      state,
      source: "receita_cnpj_csv",
      rawData: {
        ...row,
        municipio_codigo: municipalityCode,
        municipio_nome: resolvedMunicipality?.city ?? null,
        municipio_ibge: resolvedMunicipality?.ibgeCode ?? null,
        lead_score_receita: String(qualified.leadScore),
        lead_tier: qualified.leadTier,
      },
      opportunityScore,
      opportunityLevel: leadLevelFromScore(opportunityScore),
      status: duplicate?.status ?? "found",
    });

    if (result.data) {
      saved += 1;
      if (duplicate) duplicates += 1;

      await saveLeadAnalysisAdmin({
        leadCompanyId: result.data.id,
        hasWebsite: analysis.hasWebsite,
        hasPhone: analysis.hasPhone,
        hasGoogleMaps: false,
        hasInstagram: false,
        hasLowReviews: false,
        hasPoorPresence: false,
        problemsFound: ["Importado da base publica de CNPJ para prospeccao manual."],
        opportunityReason: `Qualificacao Receita: tier ${qualified.leadTier}, score ${qualified.leadScore}, canal ${qualified.recommendedChannel}, contato ${qualified.contactRoleHint}.`,
        aiSummary: null,
      });

      await saveLeadCompanyActivityAdmin({
        leadCompanyId: result.data.id,
        activityType: duplicate ? "import_update" : "import_created",
        channel: "csv_receita",
        note: `Carga ${batchLabel}. Qualificacao ${qualified.leadTier}, score ${qualified.leadScore}.`,
      });
    }
  }

  return {
    totalRead: rows.length,
    saved,
    duplicates,
  };
}
