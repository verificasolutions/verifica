import Link from "next/link";

export const metadata = {
  title: "Aviso de privacidade | Verifica",
  description: "Como os dados pessoais são tratados no portal Verifica.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-2xl px-5 py-10 text-[color:var(--text-primary)]">
      <Link href="/" className="text-sm text-[color:var(--accent)]">Voltar</Link>
      <h1 className="mt-6 text-3xl font-bold">Aviso de privacidade</h1>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">Versão 1.0 · atualizado em 26/08/2026</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-[color:var(--text-secondary)]">
        <section><h2 className="text-lg font-semibold text-[color:var(--text-primary)]">1. Dados tratados</h2><p className="mt-2">O portal pode tratar nome, telefone, placa, dados básicos do veículo, solicitações, agendamentos e histórico de serviços informados pelo cliente ou pelo estabelecimento.</p></section>
        <section><h2 className="text-lg font-semibold text-[color:var(--text-primary)]">2. Finalidades</h2><p className="mt-2">Usamos esses dados para identificar o cliente, vincular veículos, prestar e acompanhar serviços, realizar agendamentos, emitir cobranças e manter a segurança do portal.</p></section>
        <section><h2 className="text-lg font-semibold text-[color:var(--text-primary)]">3. Compartilhamento e retenção</h2><p className="mt-2">Os dados ficam disponíveis ao estabelecimento responsável pelo atendimento e aos fornecedores técnicos necessários para operar o sistema. Mantemos os dados pelo período necessário às finalidades informadas e às obrigações legais, eliminando ou anonimizando quando possível.</p></section>
        <section><h2 className="text-lg font-semibold text-[color:var(--text-primary)]">4. Direitos do titular</h2><p className="mt-2">Você pode solicitar confirmação, acesso, correção, informação sobre uso compartilhado, anonimização, bloqueio, eliminação quando aplicável e revogação de consentimentos. Solicite ao estabelecimento pelo canal de contato exibido no portal.</p></section>
        <section><h2 className="text-lg font-semibold text-[color:var(--text-primary)]">5. Segurança</h2><p className="mt-2">Adotamos controles técnicos e organizacionais proporcionais ao serviço, incluindo autenticação, controle de acesso e registro de operações relevantes. Nenhum sistema conectado à internet é totalmente livre de riscos.</p></section>
      </div>
    </main>
  );
}
