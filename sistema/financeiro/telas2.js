// Telas: Lembretes e Configurações
import { sb, q, esc, data, badge, badgeTxt, toast, formHTML, lerForm } from "./lib.js";
import { hoje, diffDias } from "./calc.js";
import { carregar, invalidar } from "./dados.js";
import { formLembrete, concluirLembrete } from "./formularios.js";
import { topo } from "./telas.js";

// ---------------------------------------------------------------------
// LEMBRETES
// ---------------------------------------------------------------------
export async function viewLembretes(el) {
  const D = await carregar();
  const ref = hoje();
  const abertos = D.lembretes.filter((l) => !l.concluido), feitos = D.lembretes.filter((l) => l.concluido);
  const sit = (l) => {
    const d = diffDias(l.vencimento, ref);
    if (d < 0) return badgeTxt(`Atrasado ${-d} dia${d === -1 ? "" : "s"}`, "vermelho");
    if (d <= 15) return badgeTxt(d === 0 ? "Hoje" : `Em ${d} dia${d === 1 ? "" : "s"}`, "amarelo");
    return badgeTxt(`Em ${d} dias`);
  };
  const linha = (l) => `<div class="lista-item">
    <input type="checkbox" data-ok="${l.id}" ${l.concluido ? "checked" : ""} title="${l.repete === "nao" ? "Concluir" : "Feito: passa para o próximo prazo"}">
    <div class="flex1 clicavel" data-ed="${l.id}" style="cursor:pointer"><div class="tit">${esc(l.titulo)}</div>
      <div class="small faint">Prazo ${data(l.vencimento)} · ${badge("repete", l.repete)}${l.observacoes ? ` · ${esc(l.observacoes)}` : ""}</div></div>
    ${l.concluido ? "" : sit(l)}</div>`;
  el.innerHTML = `
    ${topo("Lembretes", "Obrigações anuais e tarefas avulsas. DAS, DARF e pró-labore entram sozinhos nos alertas.", `<button class="btn prim" data-novo>+ Lembrete</button>`)}
    <div class="card">${abertos.length ? abertos.map(linha).join("") : `<div class="vazio">Nenhum lembrete em aberto.</div>`}</div>
    ${feitos.length ? `<div class="card"><div class="card-titulo"><h2>Concluídos</h2></div>${feitos.map(linha).join("")}</div>` : ""}
    <div class="dica">Ao marcar um lembrete que repete (mensal ou anual), o prazo avança sozinho para o próximo período.</div>`;
  el.querySelector("[data-novo]").onclick = async () => { if (await formLembrete()) viewLembretes(el); };
  el.querySelectorAll("[data-ok]").forEach((c) => (c.onchange = async () => { await concluirLembrete(D.lembretes.find((l) => l.id === c.dataset.ok)); viewLembretes(el); }));
  el.querySelectorAll("[data-ed]").forEach((d) => (d.onclick = async () => { if (await formLembrete(D.lembretes.find((l) => l.id === d.dataset.ed))) viewLembretes(el); }));
}

// ---------------------------------------------------------------------
// CONFIGURAÇÕES
// ---------------------------------------------------------------------
const GRUPOS = [
  ["Empresa", [
    { n: "empresa_nome", r: "Nome da empresa", t: "text", req: true },
    { n: "socio_nome", r: "Nome da sócia", t: "text", req: true },
    { n: "data_abertura", r: "Data de abertura (início das atividades)", t: "date", req: true, ajuda: "Define o 1º mês do cálculo do Simples (RBT12 e Fator R)." },
    { n: "saldo_inicial", r: "Saldo inicial na conta (R$)", t: "money", ajuda: "Dinheiro que já estava na conta antes do primeiro lançamento." },
    { n: "escrituracao", r: "A empresa tem escrituração contábil (livro diário/balancete)", t: "check", full: true },
  ]],
  ["Pró-labore e distribuição", [
    { n: "salario_minimo", r: "Salário mínimo (pró-labore mínimo)", t: "money", req: true },
    { n: "fator_r_alvo", r: "Fator R alvo (%)", t: "number", req: true, ajuda: "Mínimo legal 28%. O pró-labore de cada mês é este % do faturamento do próprio mês (usamos 30%)." },
    { n: "reserva_pct", r: "Reserva para despesas (% do faturamento)", t: "number", req: true },
    { n: "presuncao_pct", r: "Presunção de lucro – serviços (%)", t: "number", req: true, ajuda: "Usada no limite isento sem escrituração." },
  ]],
  ["INSS e Imposto de Renda", [
    { n: "aliq_inss", r: "INSS da sócia (%)", t: "number", req: true },
    { n: "teto_inss", r: "Teto do INSS (R$)", t: "money", req: true },
    { n: "desconto_simplificado", r: "Desconto simplificado do IRRF (R$)", t: "money", req: true },
    { n: "redutor_isento_ate", r: "Redutor: isenção total até (R$)", t: "money", req: true },
    { n: "redutor_parcial_ate", r: "Redutor: redução parcial até (R$)", t: "money", req: true },
    { n: "redutor_constante", r: "Redutor: constante (R$)", t: "money", req: true },
    { n: "redutor_fator", r: "Redutor: fator", t: "number", req: true },
  ]],
  ["Vencimentos e alertas", [
    { n: "dia_das", r: "Dia do vencimento do DAS (mês seguinte)", t: "int", min: 1, max: 31, req: true },
    { n: "dia_darf", r: "Dia do vencimento do DARF da DCTFWeb", t: "int", min: 1, max: 31, req: true },
    { n: "dia_prolabore", r: "Dia de pagar o pró-labore (no mesmo mês do faturamento)", t: "int", min: 1, max: 31, req: true },
    { n: "dias_alerta", r: "Avisar com quantos dias de antecedência", t: "int", min: 0, max: 60, req: true },
  ]],
  ["Contador", [
    { n: "honorario_contador", r: "Honorários mensais do contador (R$)", t: "money", req: true, ajuda: "Entra nas contas a pagar de todo mês e é descontado da distribuição sugerida." },
    { n: "dia_contador", r: "Dia do pagamento do contador", t: "int", min: 1, max: 31, req: true },
    { n: "contador_desde", r: "Cobrado a partir de", t: "date", req: true },
  ]],
];

export async function viewConfig(el) {
  const D = await carregar();
  const todos = GRUPOS.flatMap((g) => g[1]);
  el.innerHTML = `
    ${topo("Configurações", "Parâmetros dos cálculos. Atualize quando mudar o salário mínimo, o teto do INSS ou a tabela do IR.", `<button class="btn prim" data-salvar>Salvar</button>`)}
    ${GRUPOS.map(([tit, campos]) => `<div class="card" data-grupo><div class="card-titulo"><h2>${tit}</h2></div>${formHTML(campos, D.config)}</div>`).join("")}
    <div class="card"><div class="card-titulo"><h2>Tabelas do Simples e do IR</h2></div>
      <p class="muted small">As faixas dos Anexos III e V do Simples Nacional e a tabela mensal do IRRF 2026 ficam no arquivo <code>sistema/financeiro/calc.js</code> (constantes SIMPLES e IRRF). Se a tabela mudar, peça para atualizar.</p></div>`;
  el.querySelector("[data-salvar]").onclick = async () => {
    const dados = {};
    for (const card of el.querySelectorAll("[data-grupo]")) {
      const campos = todos.filter((c) => card.querySelector(`[name="${c.n}"]`));
      const d = lerForm(card, campos);
      if (!d) return;
      Object.assign(dados, d);
    }
    await q(sb.from("emp_config").upsert({ id: 1, ...dados }));
    invalidar();
    toast("Configurações salvas", "ok");
    viewConfig(el);
  };
}
