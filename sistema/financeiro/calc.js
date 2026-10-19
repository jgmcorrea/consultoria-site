// Cálculos do financeiro da empresa (funções puras, sem acesso ao banco)
// Simples Nacional (Anexos III e V, Fator R), pró-labore mínimo, INSS, IRRF 2026 e distribuição de lucros.

// ---------- datas (sempre strings "YYYY-MM-DD") ----------
export const hoje = () => new Date().toLocaleDateString("sv-SE");
export const mesDe = (iso) => String(iso).slice(0, 7) + "-01";
export const mesAtual = () => mesDe(hoje());
export const addMeses = (iso, n) => {
  const [a, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
export const addDias = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
};
export const diffDias = (a, b) => Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000);
const ultimoDia = (a, m) => new Date(a, m, 0).getDate();
export const diaNoMes = (mesIso, dia) => {
  const [a, m] = mesIso.slice(0, 7).split("-").map(Number);
  return `${a}-${String(m).padStart(2, "0")}-${String(Math.min(dia, ultimoDia(a, m))).padStart(2, "0")}`;
};
// Fim de semana: DAS passa para o próximo dia útil; DARF da DCTFWeb é antecipado para o dia útil anterior.
// (Feriados não são considerados: confira quando cair perto de um.)
export function ajustarDiaUtil(iso, modo) {
  let d = iso;
  for (let i = 0; i < 3; i++) {
    const dia = new Date(d + "T12:00:00").getDay();
    if (dia !== 0 && dia !== 6) break;
    d = addDias(d, modo === "ant" ? -1 : 1);
  }
  return d;
}

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const teto2 = (v) => Math.ceil(r2(v * 100) / 1) / 100; // arredonda para cima no centavo
export const soma = (arr, f = (x) => x) => r2(arr.reduce((s, x) => s + Number(f(x) || 0), 0));

// ---------- tabelas ----------
// [receita 12 meses até, alíquota nominal, parcela a deduzir, % do IRPJ dentro do DAS]
export const SIMPLES = {
  III: [[180000, 0.06, 0, 0.04], [360000, 0.112, 9360, 0.04], [720000, 0.135, 17640, 0.04], [1800000, 0.16, 35640, 0.04], [3600000, 0.21, 125640, 0.04], [4800000, 0.33, 648000, 0.35]],
  V: [[180000, 0.155, 0, 0.25], [360000, 0.18, 4500, 0.23], [720000, 0.195, 9900, 0.24], [1800000, 0.205, 17100, 0.21], [3600000, 0.23, 62100, 0.23], [4800000, 0.305, 540000, 0.35]],
};
// IRRF mensal 2026: [base até, alíquota, parcela a deduzir]
export const IRRF = [[2428.8, 0, 0], [2826.65, 0.075, 182.16], [3751.05, 0.15, 394.16], [4664.68, 0.225, 675.49], [Infinity, 0.275, 908.73]];

export function aliquotaSimples(anexo, rbt12) {
  const t = SIMPLES[anexo];
  const i = Math.max(0, t.findIndex((x) => rbt12 <= x[0]));
  const [, nom, ded, irpj] = t[i === -1 ? t.length - 1 : i];
  const efetiva = rbt12 > 0 ? Math.max(0, (rbt12 * nom - ded) / rbt12) : nom;
  return { faixa: i + 1, nominal: nom, efetiva, irpj };
}

// IR do pró-labore com o redutor da Lei 15.270/2025
export function irrfProlabore(bruto, inss, cfg) {
  const base = Math.max(0, r2(bruto - Math.max(inss, Number(cfg.desconto_simplificado))));
  const [, aliq, ded] = IRRF.find((x) => base <= x[0]);
  const tabela = Math.max(0, r2(base * aliq - ded));
  let redutor = 0;
  if (bruto <= Number(cfg.redutor_isento_ate)) redutor = tabela;
  else if (bruto <= Number(cfg.redutor_parcial_ate)) redutor = Math.min(tabela, Math.max(0, r2(Number(cfg.redutor_constante) - Number(cfg.redutor_fator) * bruto)));
  return { base, tabela, redutor, irrf: r2(tabela - redutor), usouSimplificado: Number(cfg.desconto_simplificado) > inss };
}

// ---------- resumo de lançamentos ----------
export const entradasDoMes = (L, mes) => L.filter((x) => x.tipo === "entrada" && mesDe(x.data) === mes);
export const saidasDoMes = (L, mes) => L.filter((x) => x.tipo === "saida" && mesDe(x.data) === mes);
export const faturamentoDoMes = (L, mes) => soma(entradasDoMes(L, mes).filter((x) => x.conta_faturamento), (x) => x.valor);

// ---------- fechamento mês a mês ----------
// Calcula todos os meses desde a abertura até "ate" (inclusive), em sequência,
// porque o pró-labore mínimo de um mês depende da folha dos meses anteriores.
export function calcularMeses({ lancamentos, fechamentos, config: cfg }, ate) {
  const inicio = mesDe(cfg.data_abertura);
  const ultimoLanc = lancamentos.map((x) => mesDe(x.data)).sort().pop();
  let fim = [ate, mesAtual(), ultimoLanc].filter(Boolean).sort().pop();
  if (fim < inicio) fim = inicio;
  const porMes = Object.fromEntries(fechamentos.map((f) => [f.mes.slice(0, 10), f]));
  const alvo = Number(cfg.fator_r_alvo) / 100;
  const meses = [];
  for (let m = inicio, n = 1; m <= fim; m = addMeses(m, 1), n++) {
    const f = porMes[m] || {};
    const receita = faturamentoDoMes(lancamentos, m);
    const saidas = saidasDoMes(lancamentos, m);
    const despesas = soma(saidas, (x) => x.valor);

    // janela dos meses anteriores (no máximo 12)
    const k = Math.min(n - 1, 12);
    const ant = meses.slice(meses.length - k);
    const recAnt = soma(ant, (x) => x.receita);
    const folhaAnt = soma(ant, (x) => x.prolabore);

    // RBT12: 1º mês = receita do mês × 12; depois, média dos meses anteriores × 12 (até completar 12 meses)
    const rbt12 = n === 1 ? r2(receita * 12) : k ? r2((recAnt / k) * 12) : 0;

    // pró-labore mínimo (critério combinado com o contador): o alvo (ex.: 30%) do faturamento do PRÓPRIO mês,
    // sem compensar meses anteriores, e nunca menos que o salário mínimo
    const necessario = teto2(alvo * receita);
    const minimo = Math.max(Number(cfg.salario_minimo), necessario);
    const prolabore = f.prolabore !== null && f.prolabore !== undefined ? Number(f.prolabore) : minimo;

    // Fator R do mês (folha ÷ receita dos meses anteriores; no 1º mês, do próprio mês)
    const fatorR = n === 1 ? (receita > 0 ? prolabore / receita : null) : recAnt > 0 ? folhaAnt / recAnt : null;
    const anexo = fatorR === null || fatorR >= alvo - 1e-9 ? "III" : "V";
    const aliq = aliquotaSimples(anexo, rbt12);
    const dasCalc = r2(receita * aliq.efetiva);
    const das = f.das_valor !== null && f.das_valor !== undefined ? Number(f.das_valor) : dasCalc;

    const inssCalc = r2(Math.min(prolabore, Number(cfg.teto_inss)) * Number(cfg.aliq_inss) / 100);
    const inss = f.inss_valor !== null && f.inss_valor !== undefined ? Number(f.inss_valor) : inssCalc;
    const ir = irrfProlabore(prolabore, inss, cfg);
    const irrf = f.irrf_valor !== null && f.irrf_valor !== undefined ? Number(f.irrf_valor) : ir.irrf;
    const liquidoProlabore = r2(prolabore - inss - irrf);

    const reserva = r2(receita * Number(cfg.reserva_pct) / 100);
    // honorários do contador: valor fixo mensal, a partir do mês configurado
    const contador = cfg.contador_desde && m >= mesDe(cfg.contador_desde) ? r2(Number(cfg.honorario_contador || 0)) : 0;
    const distribuicaoSugerida = Math.max(0, r2(receita - das - prolabore - contador - reserva));
    const limiteIsento = Math.max(0, r2(receita * Number(cfg.presuncao_pct) / 100 - das * aliq.irpj));
    const distribuido = f.distribuido !== null && f.distribuido !== undefined ? Number(f.distribuido) : null;

    const venc = {
      das: ajustarDiaUtil(diaNoMes(addMeses(m, 1), Number(cfg.dia_das)), "prox"),
      darf: ajustarDiaUtil(diaNoMes(addMeses(m, 1), Number(cfg.dia_darf)), "ant"),
      prolabore: diaNoMes(m, Number(cfg.dia_prolabore)), // pago no mesmo mês do faturamento
      contador: diaNoMes(m, Number(cfg.dia_contador || 25)),
    };

    meses.push({
      mes: m, n, f, receita, despesas, saidas, rbt12, fatorR, anexo, aliq, dasCalc, das,
      minimo, prolabore, prolaboreManual: f.prolabore !== null && f.prolabore !== undefined,
      inss, ir, irrf, darf: r2(inss + irrf), liquidoProlabore,
      reserva, contador, distribuicaoSugerida, limiteIsento, distribuido,
      totalPF: r2(liquidoProlabore + (distribuido ?? distribuicaoSugerida)),
      impostos: r2(das + inss + irrf),
      venc,
    });
  }
  // Fator R que o mês seguinte terá (para avisar antes)
  meses.forEach((x, i) => {
    const prox = meses[i + 1];
    if (prox) { x.fatorRProx = prox.fatorR; x.anexoProx = prox.anexo; return; }
    const k = Math.min(x.n, 12);
    const jan = meses.slice(i + 1 - k, i + 1);
    const rec = soma(jan, (y) => y.receita);
    x.fatorRProx = rec > 0 ? soma(jan, (y) => y.prolabore) / rec : null;
    x.anexoProx = x.fatorRProx === null || x.fatorRProx >= alvo - 1e-9 ? "III" : "V";
  });
  return meses;
}

// ---------- obrigações (guias e pagamentos) de um mês de competência ----------
export function obrigacoesDoMes(x) {
  const f = x.f;
  const out = [];
  if (x.das > 0) out.push({ chave: "das", nome: "DAS (Simples Nacional)", valor: x.das, venc: x.venc.das, pagoEm: f.das_pago_em || null, campo: "das_pago_em" });
  if (x.darf > 0) out.push({ chave: "darf", nome: "DARF DCTFWeb (INSS + IRRF do pró-labore)", valor: x.darf, venc: x.venc.darf, pagoEm: f.darf_pago_em || null, campo: "darf_pago_em" });
  if (x.contador > 0) out.push({ chave: "contador", nome: "Honorários do contador", valor: x.contador, venc: x.venc.contador, pagoEm: f.contador_pago_em || null, campo: "contador_pago_em" });
  if (x.prolabore > 0) out.push({ chave: "prolabore", nome: "Pró-labore líquido (transferir para a sócia)", valor: x.liquidoProlabore, venc: x.venc.prolabore, pagoEm: f.prolabore_pago_em || null, campo: "prolabore_pago_em" });
  return out;
}

// Situação de um vencimento
export function situacao(venc, pagoEm, diasAlerta, ref = hoje()) {
  if (pagoEm) return { cor: "verde", texto: "Pago" };
  const d = diffDias(venc, ref);
  if (d < 0) return { cor: "vermelho", texto: `Venceu há ${-d} dia${d === -1 ? "" : "s"}`, dias: d };
  if (d === 0) return { cor: "vermelho", texto: "Vence hoje", dias: d };
  if (d <= diasAlerta) return { cor: "amarelo", texto: `Vence em ${d} dia${d === 1 ? "" : "s"}`, dias: d };
  return { cor: "", texto: `Vence em ${d} dias`, dias: d };
}

// ---------- caixa da empresa ----------
// Dinheiro que deveria estar na conta: saldo inicial + entradas recebidas − saídas pagas
// − guias pagas − pró-labore líquido pago − lucros distribuídos.
export function caixa({ lancamentos, config }, meses) {
  const entradas = soma(lancamentos.filter((x) => x.tipo === "entrada" && x.status === "pago"), (x) => x.valor);
  const saidas = soma(lancamentos.filter((x) => x.tipo === "saida" && x.status === "pago"), (x) => x.valor);
  let guias = 0, prolabores = 0, distribuicoes = 0, contador = 0;
  for (const x of meses) {
    if (x.f.contador_pago_em) contador += x.contador;
    if (x.f.das_pago_em) guias += x.das;
    if (x.f.darf_pago_em) guias += x.darf;
    if (x.f.prolabore_pago_em) prolabores += x.liquidoProlabore;
    if (x.f.distribuido_em && x.distribuido) distribuicoes += x.distribuido;
  }
  const saldo = r2(Number(config.saldo_inicial || 0) + entradas - saidas - guias - contador - prolabores - distribuicoes);
  return { entradas, saidas, guias: r2(guias), contador: r2(contador), prolabores: r2(prolabores), distribuicoes: r2(distribuicoes), saldo };
}
