// Projeção do mês seguinte: o que os serviços já lançados nos clientes viram de faturamento,
// impostos, pró-labore e lucros quando as notas forem emitidas no mês que vem.
import { esc, moeda, nomeMes } from "./lib.js";
import { mesAtual, addMeses, calcularMeses, soma } from "./calc.js";
import { carregar } from "./dados.js";

const pctBR = (v) => (v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(2).replace(".", ",")}%`);
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const ajustes = {}; // valores digitados na tela (só nesta sessão)

// itens: [{ id, nome, servicos (mês "AAAA-MM-01"), valor, reembolso, jaEmitido, tipo: "lancado" | "estimativa", obs }]
export async function viewProjecao(el, itensDe) {
  const D = await carregar();
  const prox = addMeses(mesAtual(), 1);
  const itens = itensDe(prox.slice(0, 7));

  const desenhar = () => {
    const linhas = itens.map((i) => ({ ...i, previsto: ajustes[i.id] ?? Math.max(0, r2(i.valor - i.jaEmitido)) }));
    const extra = ajustes.__extra ?? 0;
    const previsto = r2(soma(linhas, (l) => l.previsto) + extra);
    // simula as notas com data no mês seguinte, somadas ao que já está lançado lá
    const fake = previsto > 0 ? [{ id: "projecao", tipo: "entrada", data: prox, valor: previsto, conta_faturamento: true, status: "pendente" }] : [];
    const meses = calcularMeses({ ...D, lancamentos: [...D.lancamentos, ...fake] }, prox);
    const x = meses.find((m) => m.mes === prox);
    const jaNoMes = r2((x ? x.receita : 0) - previsto);
    const reemb = soma(linhas, (l) => l.reembolso);

    el.innerHTML = `
      <div class="topo"><div class="tit"><div><h1>Projeção de ${nomeMes(prox, true).toLowerCase()}</h1>
        <div class="muted small">Notas que saem em ${nomeMes(prox, true).toLowerCase()} a partir do que já está lançado nos clientes (horas, visitas e serviços). Os valores mudam conforme você lança mais.</div></div></div></div>
      ${!x ? `<div class="card vazio">Sem dados para projetar.</div>` : `
      <div class="grid g-kpi" style="margin-top:16px">
        <div class="kpi destaque"><div class="rot">Faturamento previsto</div><div class="val">${moeda(x.receita)}</div><div class="sub">${jaNoMes > 0 ? `${moeda(previsto)} dos clientes + ${moeda(jaNoMes)} já lançado` : "Notas dos clientes"}</div></div>
        <div class="kpi"><div class="rot">DAS previsto</div><div class="val">${moeda(x.das)}</div><div class="sub">Anexo ${x.anexo} · alíquota efetiva ${pctBR(x.aliq.efetiva)}</div></div>
        <div class="kpi"><div class="rot">Pró-labore</div><div class="val">${moeda(x.prolabore)}</div><div class="sub">INSS ${moeda(x.inss)} · IRRF ${moeda(x.irrf)} · líquido ${moeda(x.liquidoProlabore)}</div></div>
        <div class="kpi"><div class="rot">Distribuição de lucros</div><div class="val">${moeda(x.distribuicaoSugerida)}</div><div class="sub">Sugerida (faturamento − DAS − pró-labore − contador − reserva de ${moeda(x.reserva)})</div></div>
        <div class="kpi"><div class="rot">Total líquido na pessoa física</div><div class="val">${moeda(r2(x.liquidoProlabore + x.distribuicaoSugerida))}</div><div class="sub">Pró-labore líquido + lucros</div></div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-titulo"><h2>Notas previstas para ${nomeMes(prox, true).toLowerCase()}</h2><span class="muted small">dá para ajustar os valores aqui para simular</span></div>
        <div class="tabela-wrap"><table><thead><tr><th>Cliente</th><th>Serviços de</th><th>Origem</th><th class="right">Calculado</th><th class="right">Valor na projeção</th><th class="right">Reembolso (fora da nota)</th></tr></thead><tbody>
        ${linhas.map((l) => `<tr>
          <td><b>${esc(l.nome)}</b>${l.obs ? `<div class="small faint">${esc(l.obs)}</div>` : ""}</td>
          <td>${nomeMes(l.servicos)}</td>
          <td>${l.tipo === "estimativa" ? `<span class="badge amarelo">estimativa</span>` : `<span class="badge verde">lançado</span>`}${l.jaEmitido ? `<div class="small faint">${moeda(l.jaEmitido)} já emitido</div>` : ""}</td>
          <td class="right num">${moeda(l.valor)}</td>
          <td class="right"><input class="proj-valor" type="number" step="0.01" min="0" data-id="${esc(l.id)}" value="${l.previsto.toFixed(2)}"></td>
          <td class="right num">${l.reembolso ? moeda(l.reembolso) : "—"}</td></tr>`).join("") || `<tr><td colspan="6" class="vazio">Nenhum cliente ativo.</td></tr>`}
        <tr><td colspan="4"><b>Outras entradas previstas</b><div class="small faint">Ex.: um serviço ainda não registrado</div></td>
          <td class="right"><input class="proj-valor" type="number" step="0.01" min="0" data-id="__extra" value="${Number(extra).toFixed(2)}"></td><td></td></tr>
        </tbody><tfoot><tr><td colspan="4">Total previsto dos clientes</td><td class="right num">${moeda(previsto)}</td><td class="right num">${reemb ? moeda(reemb) : ""}</td></tr></tfoot></table></div>
        ${Object.keys(ajustes).length ? `<p style="margin-top:10px"><button class="btn sm" data-limpar>Voltar aos valores calculados</button></p>` : ""}
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-titulo"><h2>Como fica o mês</h2></div>
        <div class="conta">
          <span>Faturamento previsto</span><span class="num right">${moeda(x.receita)}</span>
          <span class="menos">− DAS (${pctBR(x.aliq.efetiva)})</span><span class="num right">${moeda(x.das)}</span>
          <span class="menos">− Pró-labore bruto</span><span class="num right">${moeda(x.prolabore)}</span>
          ${x.contador ? `<span class="menos">− Honorários do contador</span><span class="num right">${moeda(x.contador)}</span>` : ""}
          <span class="menos">− Reserva para despesas</span><span class="num right">${moeda(x.reserva)}</span>
          <span class="tot">= Distribuição sugerida</span><span class="tot num right">${moeda(x.distribuicaoSugerida)}</span>
        </div>
        <p class="dica small" style="margin-top:10px">Pró-labore e lucros são pagos no próprio mês do faturamento. DAS e DARF (INSS + IRRF do pró-labore, ${moeda(x.darf)}) vencem no mês seguinte.${x.anexoProx === "V" ? ` <b>Atenção:</b> com esse pró-labore, o mês seguinte cairia no Anexo V.` : ""}</p>
      </div>`}`;

    el.querySelectorAll(".proj-valor").forEach((inp) => inp.addEventListener("change", () => {
      const v = Number(String(inp.value).replace(",", "."));
      ajustes[inp.dataset.id] = isFinite(v) && v >= 0 ? v : 0;
      desenhar();
    }));
    el.querySelector("[data-limpar]")?.addEventListener("click", () => { Object.keys(ajustes).forEach((k) => delete ajustes[k]); desenhar(); });
  };
  desenhar();
}
