import "server-only";
import nodemailer from "nodemailer";
import { getPlatformSettingsAdmin } from "@/backend/repos/admin-control-repo";
import type { CommercialIntakeRecord } from "@/backend/types";

function buildHtml(contractTitle: string, contractBody: string) {
  const paragraphs = contractBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 14px;line-height:1.6;color:#d7dee7;font-size:14px;">${line}</p>`)
    .join("");

  return `
    <div style="background:#0d1117;padding:32px;font-family:Arial,sans-serif;">
      <div style="max-width:760px;margin:0 auto;background:#141c24;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:28px;">
        <p style="margin:0 0 8px;color:#00f5d4;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;">Verifica Solutions</p>
        <h1 style="margin:0 0 18px;color:#ffffff;font-size:28px;line-height:1.1;">${contractTitle}</h1>
        ${paragraphs}
      </div>
    </div>
  `;
}

export async function sendCommercialContractEmail(input: { intake: CommercialIntakeRecord }) {
  const settings = await getPlatformSettingsAdmin();
  if (!settings?.smtp_host || !settings.smtp_port || !settings.smtp_from_email) {
    throw new Error("SMTP global não configurado para envio do contrato.");
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port),
    secure: Number(settings.smtp_port) === 465,
    auth:
      settings.smtp_username && settings.smtp_password
        ? {
            user: settings.smtp_username,
            pass: settings.smtp_password,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: settings.smtp_from_email,
    to: input.intake.email,
    subject: `${input.intake.contract_title} | Verifica Solutions`,
    text: input.intake.contract_body,
    html: buildHtml(input.intake.contract_title, input.intake.contract_body),
  });
}
