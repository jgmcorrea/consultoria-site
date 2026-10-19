// Extrato para o contador (PDF): mês escolhido + mês anterior, com faturamento, despesas, DAS,
// pró-labore (INSS e IRRF), distribuição de lucros e a conta do Fator R, para ele conferir antes do pagamento.
import { moeda, nomeMes, data } from "./lib.js";
import { addMeses, calcularMeses, entradasDoMes, saidasDoMes, soma } from "./calc.js";
import { carregar } from "./dados.js";

const LARANJA = [226, 102, 26], TINTA = [30, 43, 39], CINZA = [86, 100, 94], CLARO = [242, 244, 242];
const pctBR = (v, c = 2) => (v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(c).replace(".", ",")}%`);
const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export async function gerarExtratoContador(mes) {
  const { carregarScript, baixar, carregarLogo } = window.SIS.rel;
  if (!window.jspdf) await carregarScript("vendor/jspdf.umd.min.js");
  if (!window.jspdf.jsPDF.API.autoTable) await carregarScript("vendor/jspdf.plugin.autotable.min.js");
  const D = await carregar();
  const cfg = D.config;
  const meses = calcularMeses(D, mes);
  const ant = addMeses(mes, -1);
  const xA = meses.find((m) => m.mes === ant), xB = meses.find((m) => m.mes === mes);
  const cols = [xA, xB].filter(Boolean);
  const alvo = Number(cfg.fator_r_alvo);
  const logo = await carregarLogo();

  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...LARANJA); doc.rect(0, 0, W, 4, "F");
  if (logo) doc.addImage(logo.url, "JPEG", W - 15 - 28, 9, 28, 28);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...LARANJA);
  doc.text(cfg.empresa_nome || "Consultoria Isadora Andrade", 15, 16);
  doc.setFontSize(19); doc.setTextColor(...TINTA);
  doc.text("Extrato para o contador", 15, 26);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...CINZA);
  doc.text(`Período: ${cols.map((x) => nomeMes(x.mes, true)).join(" e ")}`, 15, 34);
  doc.text(`Simples Nacional · Fator R alvo: ${String(alvo).replace(".", ",")}% (mínimo legal 28%)`, 15, 40);

  const estilo = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.1, textColor: TINTA, lineColor: [220, 226, 222], lineWidth: 0.2 },
    headStyles: { fillColor: TINTA, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: CLARO, textColor: TINTA, fontStyle: "bold" },
    margin: { left: 15, right: 15, bottom: 18 },
    didDrawPage: () => {
      const H = doc.internal.pageSize.getHeight();
      doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal");
      doc.text(`Emitido em ${data(hojeISO())}`, 15, H - 9);
      doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - 15, H - 9, { align: "right" });
    },
  };
  const H = doc.internal.pageSize.getHeight();
  // título de seção; se não couber um pedaço da tabela embaixo, começa na página seguinte
  const titulo = (t, y) => { if (y > H - 50) { doc.addPage(); y = 20; } doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...TINTA); doc.text(t, 15, y); return y + 3; };
  const depois = (dy = 9) => doc.lastAutoTable.finalY + dy;

  // 1. Resumo dos dois meses
  let y = titulo("1. Resumo do mês", 50);
  const dist = (x) => x.distribuido ?? x.distribuicaoSugerida;
  const linha = (rot, f, negrito) => [{ content: rot, styles: negrito ? { fontStyle: "bold" } : {} }, ...cols.map((x) => ({ content: f(x), styles: { halign: "right", ...(negrito ? { fontStyle: "bold" } : {}) } }))];
  doc.autoTable({
    ...estilo, startY: y,
    head: [["", ...cols.map((x) => ({ content: nomeMes(x.mes, true), styles: { halign: "right" } }))]],
    body: [
      linha("Faturamento (notas de serviço)", (x) => moeda(x.receita), true),
      linha("Receita bruta 12 meses (RBT12)", (x) => moeda(x.rbt12)),
      linha("Fator R do mês", (x) => pctBR(x.fatorR)),
      linha("Anexo do Simples", (x) => `Anexo ${x.anexo}`),
      linha("Alíquota efetiva", (x) => pctBR(x.aliq.efetiva)),
      linha("DAS", (x) => moeda(x.das)),
      linha("Pró-labore bruto", (x) => moeda(x.prolabore), true),
      linha(`INSS da sócia (${String(cfg.aliq_inss).replace(".", ",")}%)`, (x) => moeda(x.inss)),
      linha("IRRF sobre o pró-labore", (x) => moeda(x.irrf)),
      linha("Pró-labore líquido", (x) => moeda(x.liquidoProlabore)),
      linha("Honorários do contador", (x) => (x.contador ? moeda(x.contador) : "—")),
      linha("Despesas lançadas", (x) => moeda(x.despesas)),
      linha(`Reserva para despesas (${String(cfg.reserva_pct).replace(".", ",")}%)`, (x) => moeda(x.reserva)),
      linha("Distribuição de lucros", (x) => `${moeda(dist(x))}${x.distribuido === null ? " (sugerida)" : ""}`, true),
      linha(cfg.escrituracao ? "Limite isento (empresa com escrituração)" : "Limite isento sem escrituração", (x) => (cfg.escrituracao ? "—" : moeda(x.limiteIsento))),
    ],
    columnStyles: { 0: { cellWidth: 82 } },
  });

  // 2. Conta do Fator R
  y = titulo(`2. Conta do Fator R (alvo de ${String(alvo).replace(".", ",")}%)`, depois());
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(...CINZA);
  const expl = doc.splitTextToSize(`Fator R = folha de salários (pró-labore) dos 12 meses anteriores ÷ receita bruta dos 12 meses anteriores. Para o mês seguinte continuar no Anexo III, o pró-labore do mês precisa ser de pelo menos ${String(alvo).replace(".", ",")}% × (receitas acumuladas, incluindo o mês) - pró-labores já pagos, e nunca menos que o salário mínimo (${moeda(cfg.salario_minimo)}).`, W - 30);
  doc.text(expl, 15, y + 3);
  y += 3 + expl.length * 3.8;
  let recAc = 0, folhaAc = 0;
  const hist = meses.filter((x) => x.mes <= mes).slice(-12).map((x) => {
    recAc += x.receita; folhaAc += x.prolabore;
    return [nomeMes(x.mes), moeda(x.receita), moeda(x.prolabore), moeda(recAc), moeda(folhaAc), pctBR(recAc > 0 ? folhaAc / recAc : null), moeda(x.minimo)];
  });
  doc.autoTable({
    ...estilo, startY: y,
    head: [["Mês", "Receita", "Pró-labore", "Receita acumulada", "Folha acumulada", "Fator R acumulado", "Pró-labore mínimo"]],
    body: hist,
    styles: { ...estilo.styles, fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 16 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });
  if (xB) {
    doc.setFontSize(8.8); doc.setTextColor(...CINZA);
    const prox = doc.splitTextToSize(`Com o pró-labore de ${moeda(xB.prolabore)} em ${nomeMes(xB.mes, true).toLowerCase()}, o Fator R do mês seguinte fica em ${pctBR(xB.fatorRProx)} (Anexo ${xB.anexoProx}).`, W - 30);
    doc.text(prox, 15, depois(5));
  }

  // 3. Lançamentos dos meses
  y = titulo("3. Entradas e saídas lançadas", depois(14));
  const lancs = cols.flatMap((x) => [...entradasDoMes(D.lancamentos, x.mes), ...saidasDoMes(D.lancamentos, x.mes)])
    .sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
  const ent = soma(lancs.filter((l) => l.tipo === "entrada"), (l) => l.valor), sai = soma(lancs.filter((l) => l.tipo === "saida"), (l) => l.valor);
  doc.autoTable({
    ...estilo, startY: y,
    head: [["Data", "Descrição", "Categoria", "Tipo", "Valor"]],
    body: lancs.length ? lancs.map((l) => [data(l.data), l.descricao + (l.nota_fiscal ? `\nNF ${l.nota_fiscal}` : ""), l.categoria || "", l.tipo === "entrada" ? "Entrada" : "Saída", { content: `${l.tipo === "saida" ? "- " : ""}${moeda(l.valor)}`, styles: { halign: "right" } }])
      : [[{ content: "Nenhum lançamento nesses meses.", colSpan: 5, styles: { halign: "center", textColor: CINZA } }]],
    foot: [["", "", "", "Entradas", { content: moeda(ent), styles: { halign: "right" } }], ["", "", "", "Saídas", { content: sai ? `- ${moeda(sai)}` : moeda(0), styles: { halign: "right" } }]],
    columnStyles: { 0: { cellWidth: 22 }, 3: { cellWidth: 20 }, 4: { cellWidth: 30 } },
    showFoot: "lastPage",
  });

  // 4. Pergunta ao contador
  if (xB) {
    y = titulo("4. Para conferência", depois(12));
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...TINTA);
    const txt = doc.splitTextToSize(`Os valores conferem? Podemos pagar em ${nomeMes(xB.mes, true).toLowerCase()} o pró-labore bruto de ${moeda(xB.prolabore)} (líquido de ${moeda(xB.liquidoProlabore)}, com INSS de ${moeda(xB.inss)} e IRRF de ${moeda(xB.irrf)}) e a distribuição de lucros de ${moeda(dist(xB))}?${!cfg.escrituracao && dist(xB) > xB.limiteIsento ? ` Observação: a distribuição passa do limite isento sem escrituração (${moeda(xB.limiteIsento)}).` : ""}`, W - 30);
    doc.text(txt, 15, y + 4);
  }

  baixar(doc.output("blob"), `Extrato para o contador - ${nomeMes(mes, true)}.pdf`);
}
