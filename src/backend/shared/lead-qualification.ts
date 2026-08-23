export type LeadQualificationRow = Record<string, string>;

export type LeadQualificationResult = {
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  cnaePrincipal: string | null;
  cnaeSecundaria: string | null;
  aberturaDate: string | null;
  contatoQuality: string;
  contactRiskLevel: "baixo" | "medio" | "alto";
  contactRoleHint: "provavel_empresa" | "possivel_contador" | "sem_sinal_claro";
  contactEvidence: string | null;
  recommendedChannel: "whatsapp_primeiro_email_de_apoio" | "email_primeiro" | "abordagem_contador_parceiro" | "baixa_prioridade";
  leadScore: number;
  leadTier: "A" | "B" | "C" | "D";
};

const ACCOUNTING_TERMS = [
  "contab",
  "contabil",
  "contador",
  "contabilidade",
  "escritorio",
  "fiscal",
  "assessoria",
  "assessor",
  "consultoria",
  "consult",
  "bpo",
];

const GENERIC_EMAIL_TERMS = ["admin", "adm", "financeiro", "faturamento", "nfe", "nf-e", "fiscal"];

export const DEFAULT_VERIFICAWASH_CNAES = new Set([
  "4520001",
  "4520002",
  "4520003",
  "4520004",
  "4520005",
  "4520006",
  "4520007",
  "4520008",
  "4543900",
]);

export function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

export function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getRowValue(row: LeadQualificationRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function formatReceitaDate(value: string | null | undefined) {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function buildLeadCnpj(row: LeadQualificationRow) {
  const direct = onlyDigits(getRowValue(row, "cnpj", "CNPJ", "cnpj_completo"));
  if (direct.length === 14) return direct;

  const basico = onlyDigits(getRowValue(row, "cnpj_basico", "CNPJ_BASICO")).padStart(8, "0");
  const ordem = onlyDigits(getRowValue(row, "cnpj_ordem", "CNPJ_ORDEM")).padStart(4, "0");
  const dv = onlyDigits(getRowValue(row, "cnpj_dv", "CNPJ_DV")).padStart(2, "0");
  const composed = `${basico}${ordem}${dv}`;
  return composed.length === 14 ? composed : null;
}

export function buildLeadPhone(row: LeadQualificationRow) {
  const ddd1 = onlyDigits(getRowValue(row, "ddd1", "DDD1"));
  const phone1 = onlyDigits(getRowValue(row, "telefone1", "TELEFONE1"));
  const ddd2 = onlyDigits(getRowValue(row, "ddd2", "DDD2"));
  const phone2 = onlyDigits(getRowValue(row, "telefone2", "TELEFONE2"));

  if (ddd1 && phone1) return `55${ddd1}${phone1}`;
  if (ddd2 && phone2) return `55${ddd2}${phone2}`;
  return null;
}

export function isLikelyMobilePhone(phone: string | null) {
  if (!phone) return false;
  const digits = onlyDigits(phone);
  return digits.length >= 12 && digits.slice(-9).startsWith("9");
}

export function getLeadCnaePrincipal(row: LeadQualificationRow) {
  return onlyDigits(getRowValue(row, "cnae_principal", "CNAE_PRINCIPAL"));
}

export function getLeadCnaeSecundaria(row: LeadQualificationRow) {
  return getRowValue(row, "cnae_secundaria", "CNAE_SECUNDARIA")
    .split(",")
    .map((item) => onlyDigits(item))
    .filter(Boolean)
    .join(",");
}

export function hasTargetCnae(row: LeadQualificationRow, targetCnaes = DEFAULT_VERIFICAWASH_CNAES) {
  const principal = getLeadCnaePrincipal(row);
  const secundarias = getLeadCnaeSecundaria(row).split(",").filter(Boolean);
  return targetCnaes.has(principal) || secundarias.some((cnae) => targetCnaes.has(cnae));
}

export function isActiveCompany(row: LeadQualificationRow) {
  const status = onlyDigits(getRowValue(row, "situacao_cadastral", "SITUACAO_CADASTRAL"));
  return !status || status === "02" || status === "2";
}

function isRecentOpening(date: string | null, months = 36) {
  if (!date) return false;
  const openedAt = new Date(`${date}T00:00:00`);
  if (Number.isNaN(openedAt.getTime())) return false;
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() - months);
  return openedAt >= threshold;
}

function hasEmailDomain(email: string | null) {
  return Boolean(email?.includes("@") && email.split("@")[1]?.includes("."));
}

function isCorporateEmail(email: string | null) {
  if (!email || !hasEmailDomain(email)) return false;
  const domain = normalizeText(email.split("@")[1]);
  return !["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br", "terra.com.br", "bol.com.br", "uol.com.br"].includes(domain);
}

function findEvidence(text: string, terms: string[]) {
  return terms.find((term) => text.includes(term)) ?? null;
}

export function qualifyLeadRow(row: LeadQualificationRow, targetCnaes = DEFAULT_VERIFICAWASH_CNAES): LeadQualificationResult {
  const cnpj = buildLeadCnpj(row);
  const phone = buildLeadPhone(row);
  const email = getRowValue(row, "email", "EMAIL").toLowerCase() || null;
  const cnaePrincipal = getLeadCnaePrincipal(row) || null;
  const cnaeSecundaria = getLeadCnaeSecundaria(row) || null;
  const aberturaDate = formatReceitaDate(getRowValue(row, "data_inicio_atividade", "DATA_INICIO_ATIVIDADE"));
  const hasPhone = Boolean(phone);
  const hasEmail = Boolean(email);
  const mobile = isLikelyMobilePhone(phone);
  const target = hasTargetCnae(row, targetCnaes);
  const recent = isRecentOpening(aberturaDate);
  const corporateEmail = isCorporateEmail(email);
  const searchText = normalizeText([
    email,
    getRowValue(row, "nome_fantasia", "NOME_FANTASIA"),
    getRowValue(row, "razao_social", "RAZAO_SOCIAL"),
    getRowValue(row, "endereco", "logradouro", "LOGRADOURO"),
  ].join(" "));
  const accountingEvidence = findEvidence(searchText, ACCOUNTING_TERMS);
  const genericEmailEvidence = findEvidence(normalizeText(email), GENERIC_EMAIL_TERMS);

  let contatoQuality = "D_SEM_CONTATO";
  if (hasPhone && hasEmail) contatoQuality = "A_TELEFONE_E_EMAIL";
  else if (hasPhone) contatoQuality = "B_SO_TELEFONE";
  else if (hasEmail) contatoQuality = "C_SO_EMAIL";

  let contactRoleHint: LeadQualificationResult["contactRoleHint"] = "sem_sinal_claro";
  if (accountingEvidence) contactRoleHint = "possivel_contador";
  else if (hasPhone || hasEmail) contactRoleHint = "provavel_empresa";

  let contactRiskLevel: LeadQualificationResult["contactRiskLevel"] = "baixo";
  if (!hasPhone && !hasEmail) contactRiskLevel = "alto";
  else if (accountingEvidence || (!mobile && !corporateEmail && genericEmailEvidence)) contactRiskLevel = "medio";

  let recommendedChannel: LeadQualificationResult["recommendedChannel"] = "baixa_prioridade";
  if (contactRoleHint === "possivel_contador") recommendedChannel = "abordagem_contador_parceiro";
  else if (hasPhone) recommendedChannel = hasEmail ? "whatsapp_primeiro_email_de_apoio" : "whatsapp_primeiro_email_de_apoio";
  else if (hasEmail) recommendedChannel = "email_primeiro";

  let leadScore = 0;
  if (target) leadScore += 35;
  if (isActiveCompany(row)) leadScore += 20;
  if (hasPhone && hasEmail) leadScore += 18;
  else if (hasPhone) leadScore += 12;
  else if (hasEmail) leadScore += 7;
  if (mobile) leadScore += 10;
  if (corporateEmail) leadScore += 7;
  if (recent) leadScore += 10;
  if (contactRoleHint === "possivel_contador") leadScore -= 12;
  if (contactRiskLevel === "alto") leadScore -= 25;
  if (!target) leadScore -= 30;
  leadScore = Math.max(0, Math.min(100, leadScore));

  const leadTier: LeadQualificationResult["leadTier"] = leadScore >= 75 ? "A" : leadScore >= 55 ? "B" : leadScore >= 35 ? "C" : "D";

  return {
    cnpj,
    phone,
    email,
    cnaePrincipal,
    cnaeSecundaria,
    aberturaDate,
    contatoQuality,
    contactRiskLevel,
    contactRoleHint,
    contactEvidence: accountingEvidence ? `termo de contabilidade: ${accountingEvidence}` : genericEmailEvidence ? `email generico: ${genericEmailEvidence}` : null,
    recommendedChannel,
    leadScore,
    leadTier,
  };
}
