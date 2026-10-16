// Formulários: lançamentos (entradas/saídas), fechamento do mês, pagamentos e lembretes
import { sb, q, toast, modal, confirmar, editar, esc, moeda, data, nomeMes, formHTML, lerForm, CAT_ENTRADA, CAT_SAIDA } from "./lib.js";
import { hoje, mesDe, addMeses, diaNoMes } from "./calc.js";
import { carregar, invalidar } from "./dados.js";

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// ---------------------------------------------------------------------
// ENTRADA / SAÍDA
// ---------------------------------------------------------------------
export async function formLancamento(tipo, registro = null) {
  tipo = registro?.tipo || tipo;
  const ent = tipo === "entrada";
  const cats = (ent ? CAT_ENTRADA : CAT_SAIDA).map((c) => [c, c]);
  if (registro && !cats.some((c) => c[0] === registro.categoria)) cats.push([registro.categoria, registro.categoria]);
  const campos = [
    { n: "data", r: ent ? "Data (da nota fiscal)" : "Data", t: "date", req: true, padrao: hoje() },
    { n: "valor", r: "Valor (R$)", t: "money", req: true },
    { n: "descricao", r: "Descrição", t: "text", req: true, full: true, ph: ent ? "Ex.: Consultoria RT – outubro" : "Ex.: Mensalidade do contador" },
    { n: "categoria", r: "Categoria", t: "select", o: cats, vazio: false, req: true, padrao: cats[0][0] },
    { n: "pessoa", r: ent ? "Cliente" : "Fornecedor", t: "text" },
    { n: "status", r: "Situação", t: "select", o: ent ? "status_entrada" : "status_saida", vazio: false, padrao: "pago" },
    ...(ent ? [{ n: "nota_fiscal", r: "Nº da nota fiscal", t: "text" }] : []),
    ...(ent ? [{ n: "conta_faturamento", r: "Conta no faturamento do Simples (nota de serviço emitida)", t: "check", full: true, padrao: true }] : []),
    { n: "observacoes", r: "Observações", t: "textarea" },
    ...(!registro ? [
      { n: "recorrente", r: "Repetir todo mês", t: "check", naoSalvar: true, full: true },
      { n: "recorrente_ate", r: "Até quando (último mês)", t: "month", naoSalvar: true, padrao: addMeses(mesDe(hoje()), 11).slice(0, 7), ajuda: "Cria um lançamento igual em cada mês. Os meses futuros entram como pendentes." },
    ] : []),
  ];
  const aoAbrir = (m) => {
    const f = m.querySelector("form");
    if (ent) {
      // categoria "Serviços" marca faturamento; as outras desmarcam
      f.categoria.addEventListener("change", () => { f.conta_faturamento.checked = f.categoria.value === CAT_ENTRADA[0]; });
    }
    if (f.recorrente) {
      const ver = () => { m.querySelector('[data-campo="recorrente_ate"]').classList.toggle("hidden", !f.recorrente.checked); };
      f.recorrente.addEventListener("change", ver);
      ver();
    }
  };
  return editar({
    tabela: "emp_lancamentos",
    titulo: registro ? `Editar ${ent ? "entrada" : "saída"}` : ent ? "Nova entrada" : "Nova saída",
    campos, registro, padroes: { tipo }, aoAbrir,
    aoExcluir: excluirLancamento,
    antesDeSalvar: async (dados, reg, m) => {
      dados.tipo = tipo;
      if (!ent) dados.conta_faturamento = false;
      const f = m.querySelector("form");
      if (!reg && f.recorrente?.checked) {
        const ate = f.recorrente_ate.value + "-01";
        const mes0 = mesDe(dados.data);
        if (ate <= mes0) { toast("O último mês precisa ser depois do primeiro.", "erro"); return false; }
        const serie = novoId(), dia = Number(dados.data.slice(8, 10)), linhas = [];
        for (let mes = mes0; mes <= ate; mes = addMeses(mes, 1))
          linhas.push({ ...dados, serie_id: serie, data: diaNoMes(mes, dia), status: mes > mesDe(hoje()) ? "pendente" : dados.status });
        await q(sb.from("emp_lancamentos").insert(linhas));
        invalidar();
        return "feito";
      }
      invalidar();
      return dados;
    },
  }).then((r) => { invalidar(); return r; });
}

export async function excluirLancamento(reg) {
  if (reg.serie_id) {
    const r = await modal({
      titulo: "Lançamento que se repete",
      corpo: `<p>Este lançamento faz parte de uma repetição mensal. O que você quer excluir?</p>`,
      botoes: [{ texto: "Cancelar", valor: null }, { texto: "Só este", valor: "um" }, { texto: "Este e os próximos", classe: "prim", valor: "prox" }],
    });
    if (!r) return false;
    if (r === "prox") await q(sb.from("emp_lancamentos").delete().eq("serie_id", reg.serie_id).gte("data", reg.data));
    else await q(sb.from("emp_lancamentos").delete().eq("id", reg.id));
  } else {
    if (!(await confirmar("Excluir este lançamento? Essa ação não pode ser desfeita."))) return false;
    await q(sb.from("emp_lancamentos").delete().eq("id", reg.id));
  }
  invalidar();
  toast("Excluído", "ok");
  return "excluido";
}

// Marca um lançamento pendente como recebido/pago
export async function alternarStatus(reg) {
  await q(sb.from("emp_lancamentos").update({ status: reg.status === "pago" ? "pendente" : "pago" }).eq("id", reg.id));
  invalidar();
}

// ---------------------------------------------------------------------
// FECHAMENTO DO MÊS (valores reais, pró-labore pago, distribuição)
// ---------------------------------------------------------------------
async function gravarFechamento(mes, dados) {
  await q(sb.from("emp_fechamentos").upsert({ mes, ...dados }, { onConflict: "mes" }));
  invalidar();
}

export async function marcarPago(x, ob) {
  if (ob.pagoEm) {
    if (!(await confirmar(`Desmarcar "${ob.nome}" de ${nomeMes(x.mes, true).toLowerCase()} como pago?`, "Desmarcar"))) return false;
    await gravarFechamento(x.mes, { [ob.campo]: null });
    return true;
  }
  const r = await modal({
    titulo: "Marcar como pago",
    corpo: `<p><b>${esc(ob.nome)}</b> · competência ${nomeMes(x.mes, true).toLowerCase()}<br><span class="muted">${moeda(ob.valor)} · vencimento ${data(ob.venc)}</span></p>
      ${formHTML([{ n: "em", r: "Pago em", t: "date", req: true, padrao: hoje() }])}`,
    botoes: [{ texto: "Cancelar", valor: null }, { texto: "Confirmar", classe: "prim", acao: (m) => lerForm(m, [{ n: "em", t: "date" }]) || false }],
  });
  if (!r) return false;
  await gravarFechamento(x.mes, { [ob.campo]: r.em });
  toast("Marcado como pago", "ok");
  return true;
}

export async function formFechamento(x) {
  const f = x.f || {};
  const campos = [
    { n: "html1", t: "html", full: true, html: `<div class="previa">Calculado pelo sistema: pró-labore mínimo <b>${moeda(x.minimo)}</b> · DAS <b>${moeda(x.dasCalc)}</b> (Anexo ${x.anexo}, ${(x.aliq.efetiva * 100).toFixed(2).replace(".", ",")}%) · INSS <b>${moeda(x.inss)}</b> · IRRF <b>${moeda(x.ir.irrf)}</b><br>Deixe em branco para usar o valor calculado.</div>` },
    { n: "prolabore", r: "Pró-labore bruto pago", t: "money", ph: x.minimo.toFixed(2), ajuda: "Se pagar menos que o mínimo, o mês seguinte pode cair no Anexo V." },
    { n: "das_valor", r: "Valor real do DAS (PGDAS)", t: "money", ph: x.dasCalc.toFixed(2) },
    { n: "inss_valor", r: "Valor real do INSS", t: "money" },
    { n: "irrf_valor", r: "Valor real do IRRF", t: "money" },
    { n: "das_pago_em", r: "DAS pago em", t: "date" },
    { n: "darf_pago_em", r: "DARF (INSS + IRRF) pago em", t: "date" },
    { n: "prolabore_pago_em", r: "Pró-labore transferido em", t: "date" },
    { n: "html2", t: "html", full: true, html: `<div class="previa">Distribuição de lucros sugerida: <b>${moeda(x.distribuicaoSugerida)}</b></div>` },
    { n: "distribuido", r: "Lucro distribuído (valor real)", t: "money", ph: x.distribuicaoSugerida.toFixed(2) },
    { n: "distribuido_em", r: "Distribuído em", t: "date" },
    { n: "observacoes", r: "Observações", t: "textarea" },
  ];
  const r = await modal({
    titulo: `Fechamento de ${nomeMes(x.mes, true).toLowerCase()}`,
    corpo: formHTML(campos, f),
    largura: 720,
    botoes: [{ texto: "Cancelar", valor: null }, { texto: "Salvar", classe: "prim", acao: (m) => {
      const d = lerForm(m, campos);
      if (!d) return false;
      if (d.distribuido_em && d.distribuido === null) d.distribuido = x.distribuicaoSugerida;
      return d;
    } }],
  });
  if (!r) return false;
  await gravarFechamento(x.mes, r);
  toast("Salvo", "ok");
  return true;
}

// Registrar a distribuição de lucros do mês
export async function formDistribuicao(x) {
  const r = await modal({
    titulo: `Distribuir lucro de ${nomeMes(x.mes, true).toLowerCase()}`,
    corpo: `<p class="muted small">Sugerido: <b>${moeda(x.distribuicaoSugerida)}</b> (faturamento − DAS − pró-labore − reserva de despesas).</p>` +
      formHTML([{ n: "distribuido", r: "Valor distribuído", t: "money", req: true, padrao: (x.distribuido ?? x.distribuicaoSugerida).toFixed(2) }, { n: "distribuido_em", r: "Data", t: "date", req: true, padrao: x.f.distribuido_em || (mesDe(hoje()) === x.mes ? hoje() : diaNoMes(x.mes, 31)), ajuda: "A distribuição é feita no mesmo mês do faturamento." }]),
    botoes: [
      ...(x.f.distribuido_em ? [{ texto: "Desfazer", classe: "perigo", valor: "desfazer" }] : []),
      { texto: "Cancelar", valor: null },
      { texto: "Salvar", classe: "prim", acao: (m) => lerForm(m, [{ n: "distribuido", t: "money" }, { n: "distribuido_em", t: "date" }]) || false },
    ],
  });
  if (!r) return false;
  await gravarFechamento(x.mes, r === "desfazer" ? { distribuido: null, distribuido_em: null } : r);
  toast("Salvo", "ok");
  return true;
}

// ---------------------------------------------------------------------
// LEMBRETES
// ---------------------------------------------------------------------
export async function formLembrete(registro = null) {
  const campos = [
    { n: "titulo", r: "O que fazer", t: "text", req: true, full: true },
    { n: "vencimento", r: "Prazo", t: "date", req: true, padrao: hoje() },
    { n: "repete", r: "Repete", t: "select", o: "repete", vazio: false, padrao: "nao" },
    { n: "observacoes", r: "Observações", t: "textarea" },
  ];
  const r = await editar({ tabela: "emp_lembretes", titulo: registro ? "Editar lembrete" : "Novo lembrete", campos, registro });
  invalidar();
  return r;
}

// Concluir: se repete, avança o prazo; se não, marca como concluído
export async function concluirLembrete(l) {
  if (l.repete === "nao") await q(sb.from("emp_lembretes").update({ concluido: !l.concluido }).eq("id", l.id));
  else {
    const passo = l.repete === "anual" ? 12 : 1;
    const novo = diaNoMes(addMeses(mesDe(l.vencimento), passo), Number(l.vencimento.slice(8, 10)));
    await q(sb.from("emp_lembretes").update({ vencimento: novo }).eq("id", l.id));
    toast(`Feito! Próximo prazo: ${data(novo)}`, "ok");
  }
  invalidar();
}

export { carregar };
