// Telas: Visão do mês, Entradas e saídas, Impostos e pró-labore, Pessoa física
import { esc, moeda, pct, data, nomeMes, badge, badgeTxt, seletorMes, ligarSeletorMes } from "./lib.js";
import { hoje, mesDe, mesAtual, addMeses, diffDias, calcularMeses, obrigacoesDoMes, situacao, caixa, entradasDoMes, saidasDoMes, soma } from "./calc.js";
import { carregar } from "./dados.js";
import { formLancamento, alternarStatus, marcarPago, formFechamento, formDistribuicao } from "./formularios.js";
import { gerarExtratoContador } from "./extrato-contador.js";

const estado = { mesInicio: mesAtual(), mesLanc: mesAtual(), aba: "todas", ano: Number(hoje().slice(0, 4)) };

export const topo = (titulo, sub, acoes = "") => `
  <div class="topo"><div class="tit">
    <div><h1>${titulo}</h1>${sub ? `<div class="muted small">${sub}</div>` : ""}</div></div>
    <div class="acoes">${acoes}</div></div>`;

const botoesLancar = `<button class="btn" data-nova-saida>+ Saída</button><button class="btn prim" data-nova-entrada>+ Entrada</button>`;
function ligarLancar(el, recarregar) {
  el.querySelector("[data-nova-entrada]")?.addEventListener("click", async () => { if (await formLancamento("entrada")) recarregar(); });
  el.querySelector("[data-nova-saida]")?.addEventListener("click", async () => { if (await formLancamento("saida")) recarregar(); });
}
const pctBR = (v, c = 2) => (v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(c).replace(".", ",")}%`);
const linhaMes = (meses, mes) => meses.find((x) => x.mes === mes);

// Todas as obrigações (de todos os meses), com situação
function todasObrigacoes(meses, cfg) {
  return meses.flatMap((x) => obrigacoesDoMes(x).map((o) => ({ ...o, x, sit: situacao(o.venc, o.pagoEm, Number(cfg.dias_alerta)) })));
}

// ---------------------------------------------------------------------
// ALERTAS
// ---------------------------------------------------------------------
export function alertas(D, meses, mesSel) {
  const cfg = D.config, out = [], ref = hoje(), diasA = Number(cfg.dias_alerta);
  for (const o of todasObrigacoes(meses, cfg)) {
    if (o.pagoEm) continue;
    const comp = `competência ${nomeMes(o.x.mes)}`;
    if (o.sit.cor === "vermelho") out.push(["vermelho", "🧾", `<b>${esc(o.nome)}</b> (${comp}) de ${moeda(o.valor)}: ${o.sit.texto.toLowerCase()} (${data(o.venc)}). Marque como pago quando pagar.`]);
    else if (o.sit.cor === "amarelo") out.push(["amarelo", "🧾", `<b>${esc(o.nome)}</b> (${comp}) de ${moeda(o.valor)} ${o.sit.texto.toLowerCase()} (${data(o.venc)}).`]);
  }
  for (const l of D.lembretes.filter((l) => !l.concluido)) {
    const d = diffDias(l.vencimento, ref);
    if (d < 0) out.push(["vermelho", "📌", `<b>${esc(l.titulo)}</b>: prazo era ${data(l.vencimento)}.`]);
    else if (d <= Math.max(diasA, 15)) out.push(["amarelo", "📌", `<b>${esc(l.titulo)}</b>: prazo em ${d === 0 ? "hoje" : `${d} dia${d === 1 ? "" : "s"}`} (${data(l.vencimento)}).`]);
  }
  const x = linhaMes(meses, mesSel);
  if (x) {
    if (x.anexo === "V") out.push(["vermelho", "⚠️", `Em ${nomeMes(x.mes, true).toLowerCase()} a empresa está no <b>Anexo V</b> (Fator R ${pctBR(x.fatorR)}): o DAS fica bem mais caro.`]);
    if (x.anexoProx === "V") out.push(["vermelho", "⚠️", `Com o pró-labore de ${moeda(x.prolabore)}, o mês seguinte cai no <b>Anexo V</b> (Fator R ${pctBR(x.fatorRProx)}). O mínimo para continuar no Anexo III é <b>${moeda(x.minimo)}</b>.`]);
    const dist = x.distribuido ?? x.distribuicaoSugerida;
    if (!cfg.escrituracao && dist > x.limiteIsento)
      out.push(["amarelo", "📒", `A distribuição de ${nomeMes(x.mes, true).toLowerCase()} (${moeda(dist)}) passa do limite isento sem escrituração (${moeda(x.limiteIsento)}). Para distribuir tudo sem imposto, a empresa precisa de escrituração contábil (confirme com o contador e marque em Configurações).`]);
    if (dist > 50000) out.push(["amarelo", "💰", `Distribuição acima de R$ 50 mil no mês: pela Lei 15.270/2025 há retenção de 10% de IR na fonte sobre o total.`]);
    if (x.despesas > x.reserva && x.receita > 0) out.push(["amarelo", "📉", `As despesas de ${nomeMes(x.mes, true).toLowerCase()} (${moeda(x.despesas)}) passaram da reserva de ${String(cfg.reserva_pct).replace(".", ",")}% (${moeda(x.reserva)}). Distribua menos para não faltar caixa.`]);
  }
  return out;
}

// ---------------------------------------------------------------------
// VISÃO DO MÊS
// ---------------------------------------------------------------------
export async function viewInicio(el) {
  const D = await carregar();
  const mes = estado.mesInicio;
  const meses = calcularMeses(D, mes);
  const x = linhaMes(meses, mes);
  const cfg = D.config;
  const avisos = alertas(D, meses, mes);
  const cx = caixa(D, meses);
  const recarregar = () => viewInicio(el);
  const obrigs = todasObrigacoes(meses, cfg);
  const venceNoMes = obrigs.filter((o) => mesDe(o.venc) === mes).sort((a, b) => a.venc.localeCompare(b.venc));
  const atrasadas = obrigs.filter((o) => !o.pagoEm && o.venc < mes && o.venc < hoje());

  const corpoX = !x ? `<div class="card vazio">Este mês é anterior à abertura da empresa (${data(cfg.data_abertura)}).</div>` : `
    <div class="grid g-kpi" style="margin-top:16px">
      <div class="kpi"><div class="rot">Faturamento do mês</div><div class="val">${moeda(x.receita)}</div><div class="sub">Notas de serviço com data no mês</div></div>
      <div class="kpi"><div class="rot">Impostos do mês</div><div class="val">${moeda(x.impostos)}</div><div class="sub">DAS ${moeda(x.das)} · INSS ${moeda(x.inss)} · IRRF ${moeda(x.irrf)}</div></div>
      <div class="kpi"><div class="rot">Pró-labore</div><div class="val">${moeda(x.prolabore)}</div><div class="sub">Líquido para a sócia: ${moeda(x.liquidoProlabore)}${x.prolaboreManual ? "" : " · mínimo calculado"}</div></div>
      <div class="kpi"><div class="rot">Distribuição de lucros</div><div class="val">${moeda(x.distribuido ?? x.distribuicaoSugerida)}</div><div class="sub">${x.distribuido !== null ? `Registrada${x.f.distribuido_em ? ` em ${data(x.f.distribuido_em)}` : ""}` : "Sugerida (ainda não registrada)"}</div></div>
      <div class="kpi destaque"><div class="rot">Total líquido na pessoa física</div><div class="val">${moeda(x.totalPF)}</div><div class="sub">Pró-labore líquido + lucros</div></div>
    </div>

    <div class="grid g2" style="margin-top:16px">
      <div class="card">
        <div class="card-titulo"><h2>A pagar neste mês</h2><span class="muted small">pró-labore de ${nomeMes(mes)} · guias de ${nomeMes(addMeses(mes, -1))}</span></div>
        ${venceNoMes.length || atrasadas.length ? [...atrasadas, ...venceNoMes].map((o, i) => `
          <div class="obrig">
            <div><div class="nome">${esc(o.nome)}</div><div class="small faint">Competência ${nomeMes(o.x.mes)} · vence ${data(o.venc)}</div></div>
            <div class="num right"><b>${moeda(o.valor)}</b></div>
            <div>${badgeTxt(o.sit.texto, o.sit.cor)}</div>
            <div class="acao"><button class="btn sm ${o.pagoEm ? "ghost" : ""}" data-pagar="${o.x.mes}|${o.chave}">${o.pagoEm ? `Pago ${data(o.pagoEm).slice(0, 5)}` : "Marcar pago"}</button></div>
          </div>`).join("") : `<div class="vazio">Nada vence neste mês.</div>`}
        <div class="dica">Datas ajustadas para fins de semana (DAS passa para o próximo dia útil; DARF é antecipado). Feriados não são considerados.</div>
      </div>

      <div class="card">
        <div class="card-titulo"><h2>Como chega na distribuição</h2><button class="btn sm" data-distribuir>${x.f.distribuido_em ? "Editar distribuição" : "Registrar distribuição"}</button></div>
        <div class="conta">
          <span>Faturamento</span><span class="num right">${moeda(x.receita)}</span>
          <span class="menos">− DAS (Anexo ${x.anexo}, ${pctBR(x.aliq.efetiva)})</span><span class="num right">${moeda(x.das)}</span>
          <span class="menos">− Pró-labore bruto</span><span class="num right">${moeda(x.prolabore)}</span>
          ${x.contador ? `<span class="menos">− Honorários do contador</span><span class="num right">${moeda(x.contador)}</span>` : ""}
          <span class="menos">− Reserva para despesas (${String(cfg.reserva_pct).replace(".", ",")}%)</span><span class="num right">${moeda(x.reserva)}</span>
          <span class="tot">= Distribuição sugerida</span><span class="tot num right">${moeda(x.distribuicaoSugerida)}</span>
          <span class="ind">Despesas lançadas no mês</span><span class="num right faint">${moeda(x.despesas)}</span>
          <span class="ind">Limite isento sem escrituração</span><span class="num right faint">${cfg.escrituracao ? "tem escrituração" : moeda(x.limiteIsento)}</span>
        </div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:16px">
      <div class="card">
        <div class="card-titulo"><h2>Fator R e anexo</h2>${badge("anexo", x.anexo)}</div>
        <dl class="info-lista">
          <dt>Fator R do mês</dt><dd>${pctBR(x.fatorR)} <span class="faint small">(mínimo ${String(cfg.fator_r_alvo).replace(".", ",")}%)</span></dd>
          <dt>Receita 12 meses (RBT12)</dt><dd>${moeda(x.rbt12)} · faixa ${x.aliq.faixa}</dd>
          <dt>Alíquota efetiva</dt><dd>${pctBR(x.aliq.efetiva)}</dd>
          <dt>Pró-labore mínimo</dt><dd><b>${moeda(x.minimo)}</b> <span class="faint small">para o mês seguinte continuar no Anexo III</span></dd>
          <dt>Mês seguinte</dt><dd>${badge("anexo", x.anexoProx)} <span class="small">Fator R ${pctBR(x.fatorRProx)}</span></dd>
        </dl>
        <div class="acoes-card"><button class="btn sm" data-fechamento>Ajustar valores do mês</button></div>
      </div>
      <div class="card">
        <div class="card-titulo"><h2>Caixa da empresa (hoje)</h2><span class="num ${cx.saldo < 0 ? "neg" : "pos"}"><b>${moeda(cx.saldo)}</b></span></div>
        <div class="conta">
          <span>Saldo inicial</span><span class="num right">${moeda(cfg.saldo_inicial)}</span>
          <span>+ Entradas recebidas</span><span class="num right">${moeda(cx.entradas)}</span>
          <span class="menos">− Saídas pagas</span><span class="num right">${moeda(cx.saidas)}</span>
          <span class="menos">− Guias pagas (DAS e DARF)</span><span class="num right">${moeda(cx.guias)}</span>
          ${cx.contador ? `<span class="menos">− Contador pago</span><span class="num right">${moeda(cx.contador)}</span>` : ""}
          <span class="menos">− Pró-labore líquido transferido</span><span class="num right">${moeda(cx.prolabores)}</span>
          <span class="menos">− Lucros distribuídos</span><span class="num right">${moeda(cx.distribuicoes)}</span>
          <span class="tot">= Deveria haver na conta</span><span class="tot num right">${moeda(cx.saldo)}</span>
        </div>
        <div class="dica">Compare com o extrato do banco. Se não bater, falta lançar alguma entrada ou saída.</div>
      </div>
    </div>`;

  el.innerHTML = `
    ${topo("Visão do mês", nomeMes(mes, true), seletorMes(mes) + `<button class="btn" data-extrato-contador title="PDF com ${nomeMes(addMeses(mes, -1))} e ${nomeMes(mes)}">Extrato para o contador</button>` + botoesLancar)}
    ${avisos.length ? `<div class="card"><div class="card-titulo"><h2>Alertas</h2><span class="badge amarelo">${avisos.length}</span></div>
      ${avisos.map(([cor, ico, txt]) => `<div class="alerta ${cor}"><span class="ico">${ico}</span><div class="flex1">${txt}</div></div>`).join("")}</div>` : ""}
    ${corpoX}`;

  ligarSeletorMes(el, mes, addMeses, (m) => { estado.mesInicio = m; recarregar(); });
  ligarLancar(el, recarregar);
  el.querySelector("[data-extrato-contador]")?.addEventListener("click", async (ev) => {
    const b = ev.currentTarget, t = b.textContent; b.disabled = true; b.textContent = "Gerando…";
    try { await gerarExtratoContador(mes); } catch (e) { console.error(e); window.SIS.toast("Não foi possível gerar o extrato: " + (e.message || e), true); } finally { b.disabled = false; b.textContent = t; }
  });
  el.querySelectorAll("[data-pagar]").forEach((b) => (b.onclick = async () => {
    const [m, chave] = b.dataset.pagar.split("|");
    const o = obrigs.find((y) => y.x.mes === m && y.chave === chave);
    if (await marcarPago(o.x, o)) recarregar();
  }));
  el.querySelector("[data-distribuir]")?.addEventListener("click", async () => { if (await formDistribuicao(x)) recarregar(); });
  el.querySelector("[data-fechamento]")?.addEventListener("click", async () => { if (await formFechamento(x)) recarregar(); });
}

// ---------------------------------------------------------------------
// ENTRADAS E SAÍDAS
// ---------------------------------------------------------------------
export async function viewLancamentos(el) {
  const D = await carregar();
  const mes = estado.mesLanc;
  const recarregar = () => viewLancamentos(el);
  const ent = entradasDoMes(D.lancamentos, mes), sai = saidasDoMes(D.lancamentos, mes);
  const lista = (estado.aba === "entradas" ? ent : estado.aba === "saidas" ? sai : [...ent, ...sai]).sort((a, b) => a.data.localeCompare(b.data));
  const fat = soma(ent.filter((x) => x.conta_faturamento), (x) => x.valor);
  const totE = soma(ent, (x) => x.valor), totS = soma(sai, (x) => x.valor);
  const pend = (arr) => soma(arr.filter((x) => x.status === "pendente"), (x) => x.valor);

  el.innerHTML = `
    ${topo("Entradas e saídas", nomeMes(mes, true), seletorMes(mes) + botoesLancar)}
    <div class="grid g-kpi">
      <div class="kpi verde"><div class="rot">Entradas</div><div class="val">${moeda(totE)}</div><div class="sub">${moeda(pend(ent))} a receber</div></div>
      <div class="kpi"><div class="rot">Faturamento (Simples)</div><div class="val">${moeda(fat)}</div><div class="sub">Só notas de serviço</div></div>
      <div class="kpi vermelho"><div class="rot">Saídas</div><div class="val">${moeda(totS)}</div><div class="sub">${moeda(pend(sai))} a pagar</div></div>
      <div class="kpi ${totE - totS < 0 ? "vermelho" : ""}"><div class="rot">Entradas − saídas</div><div class="val">${moeda(totE - totS)}</div><div class="sub">Antes de impostos e pró-labore</div></div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="seg" style="margin-bottom:14px">${[["todas", "Todas"], ["entradas", "Entradas"], ["saidas", "Saídas"]].map(([k, r]) => `<button data-aba="${k}" class="${estado.aba === k ? "ativo" : ""}">${r}</button>`).join("")}</div>
      ${lista.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Cliente / fornecedor</th><th class="right">Valor</th><th>Situação</th><th></th></tr></thead>
        <tbody>${lista.map((l) => `<tr class="clicavel" data-id="${l.id}">
          <td class="nowrap">${data(l.data)}</td>
          <td>${esc(l.descricao)}${l.serie_id ? ` <span class="faint small" title="Repete todo mês">↻</span>` : ""}${l.nota_fiscal ? `<div class="small faint">NF ${esc(l.nota_fiscal)}</div>` : ""}</td>
          <td>${badge("tipo", l.tipo)} <span class="small muted">${esc(l.categoria)}</span>${l.tipo === "entrada" && !l.conta_faturamento ? `<div class="small faint">não conta no faturamento</div>` : ""}</td>
          <td class="muted">${esc(l.pessoa || "—")}</td>
          <td class="right num ${l.tipo === "saida" ? "neg" : "pos"}">${l.tipo === "saida" ? "−" : ""}${moeda(l.valor)}</td>
          <td>${badge(l.tipo === "entrada" ? "status_entrada" : "status_saida", l.status)}</td>
          <td><div class="acoes-linha"><button class="btn sm" data-status="${l.id}">${l.status === "pago" ? "Desfazer" : l.tipo === "entrada" ? "Recebi" : "Paguei"}</button></div></td>
        </tr>`).join("")}</tbody></table></div>` : `<div class="vazio">Nenhum lançamento neste mês.</div>`}
      <div class="dica">Impostos, pró-labore e distribuição de lucros não precisam ser lançados aqui: eles são calculados e marcados na Visão do mês.</div>
    </div>`;

  ligarSeletorMes(el, mes, addMeses, (m) => { estado.mesLanc = m; recarregar(); });
  ligarLancar(el, recarregar);
  el.querySelectorAll("[data-aba]").forEach((b) => (b.onclick = () => { estado.aba = b.dataset.aba; recarregar(); }));
  el.querySelectorAll("[data-status]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    await alternarStatus(D.lancamentos.find((x) => x.id === b.dataset.status));
    recarregar();
  }));
  el.querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = async () => {
    if (await formLancamento(null, D.lancamentos.find((x) => x.id === tr.dataset.id))) recarregar();
  }));
}

// ---------------------------------------------------------------------
// IMPOSTOS E PRÓ-LABORE (planilha mês a mês)
// ---------------------------------------------------------------------
export async function viewFechamento(el) {
  const D = await carregar();
  const meses = calcularMeses(D, addMeses(mesAtual(), 1));
  const cfg = D.config;
  const atual = mesAtual();
  const ic = (pago) => (pago ? `<span class="pos" title="Pago">✓</span>` : `<span class="faint" title="Em aberto">○</span>`);
  const tot = (k) => moeda(soma(meses, (x) => x[k]));
  el.innerHTML = `
    ${topo("Impostos e pró-labore", `Mês a mês desde a abertura (${data(cfg.data_abertura)}). Clique num mês para informar valores reais ou pagamentos.`)}
    <div class="card">
      <div class="tabela-wrap"><table class="planilha">
        <thead><tr><th>Mês</th><th class="right">Faturamento</th><th class="right">RBT12</th><th class="right">Fator R</th><th>Anexo</th><th class="right">Alíquota</th>
          <th class="right">DAS</th><th class="right">Pró-labore mín.</th><th class="right">Pró-labore pago</th><th class="right">INSS</th><th class="right">IRRF</th>
          <th class="right">Reserva</th><th class="right">Distribuição</th><th class="right">Limite isento</th><th>DAS</th><th>DARF</th><th>Pró-lab.</th></tr></thead>
        <tbody>${meses.map((x) => `<tr class="clicavel ${x.mes === atual ? "atual" : ""}" data-mes="${x.mes}">
          <td>${nomeMes(x.mes)}</td>
          <td class="right num">${moeda(x.receita)}</td>
          <td class="right num faint">${moeda(x.rbt12)}</td>
          <td class="right num">${pctBR(x.fatorR, 1)}</td>
          <td>${badge("anexo", x.anexo)}</td>
          <td class="right num">${pctBR(x.aliq.efetiva)}</td>
          <td class="right num">${moeda(x.das)}${x.f.das_valor != null ? " *" : ""}</td>
          <td class="right num faint">${moeda(x.minimo)}</td>
          <td class="right num ${x.prolabore < x.minimo - 0.005 ? "neg" : ""}"><b>${moeda(x.prolabore)}</b></td>
          <td class="right num">${moeda(x.inss)}</td>
          <td class="right num">${moeda(x.irrf)}</td>
          <td class="right num faint">${moeda(x.reserva)}</td>
          <td class="right num">${moeda(x.distribuido ?? x.distribuicaoSugerida)}${x.distribuido === null ? ` <span class="faint small">sug.</span>` : ""}</td>
          <td class="right num ${!cfg.escrituracao && (x.distribuido ?? x.distribuicaoSugerida) > x.limiteIsento ? "amarelo-txt" : "faint"}">${moeda(x.limiteIsento)}</td>
          <td>${ic(x.f.das_pago_em || x.das === 0)}</td><td>${ic(x.f.darf_pago_em || x.darf === 0)}</td><td>${ic(x.f.prolabore_pago_em)}</td>
        </tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="right num">${tot("receita")}</td><td></td><td></td><td></td><td></td><td class="right num">${tot("das")}</td><td></td>
          <td class="right num">${tot("prolabore")}</td><td class="right num">${tot("inss")}</td><td class="right num">${tot("irrf")}</td><td class="right num">${tot("reserva")}</td>
          <td class="right num">${moeda(soma(meses, (x) => x.distribuido ?? x.distribuicaoSugerida))}</td><td></td><td></td><td></td><td></td></tr></tfoot>
      </table></div>
      <div class="dica">
        <b>Pró-labore mín.</b>: o maior valor entre o salário mínimo e o necessário para o Fator R do mês seguinte ficar em ${String(cfg.fator_r_alvo).replace(".", ",")}% (soma da folha ÷ soma do faturamento dos últimos meses, até 12).
        Pró-labore em vermelho = abaixo do mínimo. * = valor real informado. Limite isento em amarelo = distribuição acima do limite sem escrituração.
        Valores de referência: confira sempre com o contador.
      </div>
    </div>`;
  el.querySelectorAll("tr[data-mes]").forEach((tr) => (tr.onclick = async () => {
    if (await formFechamento(meses.find((x) => x.mes === tr.dataset.mes))) viewFechamento(el);
  }));
}

// ---------------------------------------------------------------------
// PESSOA FÍSICA
// ---------------------------------------------------------------------
export async function viewPF(el) {
  const D = await carregar();
  const ano = estado.ano;
  const meses = calcularMeses(D, `${ano}-12-01`).filter((x) => x.mes.startsWith(String(ano)) && x.mes <= addMeses(mesAtual(), 1));
  const dist = (x) => x.distribuido ?? x.distribuicaoSugerida;
  const t = (f) => soma(meses, f);
  el.innerHTML = `
    ${topo("Pessoa física", `${esc(D.config.socio_nome)} · o que entra líquido e o que vai para a declaração de IR`,
      `<div class="mes-nav"><button class="btn sm" data-ano="-1">‹</button><span class="ano">${ano}</span><button class="btn sm" data-ano="1">›</button></div>`)}
    <div class="grid g-kpi">
      <div class="kpi"><div class="rot">Pró-labore bruto no ano</div><div class="val">${moeda(t((x) => x.prolabore))}</div><div class="sub">Rendimento tributável</div></div>
      <div class="kpi"><div class="rot">INSS + IRRF retidos</div><div class="val">${moeda(t((x) => x.inss + x.irrf))}</div><div class="sub">INSS ${moeda(t((x) => x.inss))} · IRRF ${moeda(t((x) => x.irrf))}</div></div>
      <div class="kpi"><div class="rot">Lucros recebidos</div><div class="val">${moeda(t(dist))}</div><div class="sub">Rendimento isento (inclui sugeridos não registrados)</div></div>
      <div class="kpi destaque"><div class="rot">Total líquido no ano</div><div class="val">${moeda(t((x) => x.totalPF))}</div><div class="sub">Pró-labore líquido + lucros</div></div>
    </div>
    <div class="card" style="margin-top:16px">
      ${meses.length ? `<div class="tabela-wrap"><table class="planilha">
        <thead><tr><th>Mês</th><th class="right">Pró-labore bruto</th><th class="right">INSS</th><th class="right">Base IR</th><th class="right">IR tabela</th><th class="right">Redutor</th><th class="right">IRRF</th><th class="right">Pró-labore líquido</th><th class="right">Lucros</th><th class="right">Total líquido</th></tr></thead>
        <tbody>${meses.map((x) => `<tr ${x.mes === mesAtual() ? 'class="atual"' : ""}>
          <td>${nomeMes(x.mes)}</td><td class="right num">${moeda(x.prolabore)}</td><td class="right num">${moeda(x.inss)}</td>
          <td class="right num faint" title="${x.ir.usouSimplificado ? "Usou o desconto simplificado" : "Usou o INSS como dedução"}">${moeda(x.ir.base)}</td>
          <td class="right num faint">${moeda(x.ir.tabela)}</td><td class="right num faint">${moeda(x.ir.redutor)}</td>
          <td class="right num">${moeda(x.irrf)}</td><td class="right num">${moeda(x.liquidoProlabore)}</td>
          <td class="right num">${moeda(dist(x))}${x.distribuido === null ? ` <span class="faint small">sug.</span>` : ""}</td>
          <td class="right num"><b>${moeda(x.totalPF)}</b></td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="right num">${moeda(t((x) => x.prolabore))}</td><td class="right num">${moeda(t((x) => x.inss))}</td><td></td><td></td><td></td>
          <td class="right num">${moeda(t((x) => x.irrf))}</td><td class="right num">${moeda(t((x) => x.liquidoProlabore))}</td><td class="right num">${moeda(t(dist))}</td><td class="right num">${moeda(t((x) => x.totalPF))}</td></tr></tfoot>
      </table></div>` : `<div class="vazio">Sem meses neste ano.</div>`}
      <div class="dica">Base do IR = pró-labore − o maior entre o INSS e o desconto simplificado (${moeda(D.config.desconto_simplificado)}). Redutor da Lei 15.270/2025: isenção total até ${moeda(D.config.redutor_isento_ate)} e parcial até ${moeda(D.config.redutor_parcial_ate)}.</div>
    </div>`;
  el.querySelectorAll("[data-ano]").forEach((b) => (b.onclick = () => { estado.ano += Number(b.dataset.ano); viewPF(el); }));
}
