// Financeiro de cada cliente: condições do contrato, cálculo do mês, notas fiscais e alertas.
// Cada nota emitida aqui cria uma ENTRADA no Financeiro da Empresa (emp_lancamentos).
// O reembolso (ex.: gasolina por container) fica só aqui: não tem nota e não entra nos cálculos da empresa.
(() => {
  const { S, esc, toast, falha, hoje, fmtData, diasAte, fmtDur, fmtDec, nomeMes, abrirModal, fecharModal, guardarLocal, render, cliente, horasDe, minutosDe } = window.SIS;

  const NFSE_EMISSOR = "https://www.nfse.gov.br/EmissorNacional";
  const NFSE_EMITIDAS = "https://www.nfse.gov.br/EmissorNacional/Notas/Emitidas";
  const DIAS_ALERTA = 30; // avisa com 30 dias de antecedência
  const DESCRICAO_PADRAO = "Prestação de serviços de consultoria técnica em qualidade e segurança de alimentos - competência {competencia}.";
  const DESCRICAO_SERVICO = "Prestação de serviços de consultoria técnica: {servicos} - competência {competencia}.";

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (v) => (v === null || v === undefined || v === "" || isNaN(v) ? "—" : brl.format(Number(v)));
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const fmtNum = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const addMes = (ym, n) => { const [a, m] = ym.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const compCurta = (ym) => { const [a, m] = ym.split("-"); return `${m}/${a}`; };
  const unidades = (c) => (c.unidade_nome || "unidade");
  // Regra geral: as horas de um mês são faturadas no mês seguinte, e a aba abre no mês anterior (o que está para emitir).
  // Clientes com "nota no mesmo mês" (ex.: Queijo & Cia): a nota sai no próprio mês dos serviços, e a aba abre no mês atual.
  const mesmoMes = (c) => !!(c && c.nota_mesmo_mes);
  const mesDaNota = (c, ym) => (mesmoMes(c) ? ym : addMes(ym, 1));
  const mesTrabalhoPadrao = (c) => (mesmoMes(c) ? hoje().slice(0, 7) : addMes(hoje().slice(0, 7), -1));
  const mesNome = (ym) => nomeMes(ym).split(" ")[0].toLowerCase();
  const fimDeSemana = (iso) => [0, 6].includes(new Date(iso + "T12:00").getDay());
  // Visitas (registros de container): com carregamento = quantidade × valor por unidade;
  // sem carregamento = valor do dia sem carga, se ficou pelo menos as horas mínimas. Deslocamento e despesas: reembolso.
  const visitasDe = (c, ym) => S.dados.unidades.filter((u) => u.cliente_id === c.id && (!ym || u.data.startsWith(ym)))
    .sort((a, b) => a.data.localeCompare(b.data) || String(a.criado_em || "").localeCompare(String(b.criado_em || "")));
  function visita(c, u) {
    const carga = u.carregamento !== false;
    const qtd = carga ? Number(u.quantidade || 0) : 0;
    // sem carregamento: valor fixo do dia (ex.: R$ 300), independente do tempo no local
    const valor = carga ? r2(qtd * (num(c.valor_unidade) || 0)) : r2(num(c.valor_sem_carga) || 0);
    return { u, carga, qtd, valor, desloc: r2(num(c.reembolso_unidade) || 0), despesa: r2(num(u.despesa_valor) || 0) };
  }
  const plural = (q, nome) => `${fmtNum(q)} ${nome}${Number(q) === 1 ? "" : "s"}`;

  // ------------------------------------------------------------------
  // Cálculo do mês
  // ------------------------------------------------------------------
  // Serviços prestados no mês (qualquer forma de cobrança pode ter serviços avulsos)
  const servicosDe = (c, ym) => (S.dados.servicos || []).filter((x) => x.cliente_id === c.id && (!ym || x.data.startsWith(ym)))
    .sort((a, b) => a.data.localeCompare(b.data) || String(a.criado_em || "").localeCompare(String(b.criado_em || "")));

  function calcMes(c, ym) {
    const minutos = horasDe(c.id).filter((h) => h.data.startsWith(ym)).reduce((s, h) => s + minutosDe(h), 0);
    const horas = minutos / 60;
    const modelo = c.modelo_cobranca || "hora";
    const servs = servicosDe(c, ym);
    const comNF = servs.filter((x) => x.emite_nf !== false), semNF = servs.filter((x) => x.emite_nf === false);
    const out = { modelo, minutos, horas, quantidade: 0, valor: 0, reembolso: 0, linhas: [], configurado: true,
      servicosNF: comNF.length, semNota: r2(semNF.reduce((s, x) => s + Number(x.valor || 0), 0)), semNotaQtd: semNF.length,
      servicosTxt: comNF.map((x) => x.descricao).join("; ") };
    const somaServicos = () => comNF.forEach((x) => { out.linhas.push([`${esc(x.descricao)} <span class="dica">(${fmtData(x.data)})</span>`, r2(x.valor)]); out.valor = r2(out.valor + Number(x.valor || 0)); });
    if (modelo === "servico") {
      somaServicos();
      if (!comNF.length) out.linhas.push(["Nenhum serviço com nota neste mês", 0]);
      return out;
    }
    const fim = (o) => { if (o.configurado) somaServicos(); return o; };
    // Fim de semana (sábado e domingo): se o cliente tem valor da hora de fim de semana, essas horas são cobradas
    // à parte, por esse valor (no pacote, não consomem as horas do pacote).
    const vf = num(c.valor_hora_fds);
    const minFds = vf === null ? 0 : horasDe(c.id).filter((h) => h.data.startsWith(ym) && fimDeSemana(h.data)).reduce((s, h) => s + minutosDe(h), 0);
    const minSemana = minutos - minFds;
    out.minFds = minFds;
    const linhaFds = () => { if (minFds > 0) { const v = r2((minFds / 60) * vf); out.valor = r2(out.valor + v); out.linhas.push([`${fmtDur(minFds)} em fim de semana (${fmtDec(minFds)}) × ${moeda(vf)}`, v]); } };
    if (modelo === "hora") {
      const vh = num(c.valor_hora);
      if (vh === null) { out.configurado = false; return out; }
      out.valor = r2((minSemana / 60) * vh);
      out.linhas.push([`${fmtDur(minSemana)}${minFds ? " em dias de semana" : ""} (${fmtDec(minSemana)}) × ${moeda(vh)}`, out.valor]);
      linhaFds();
    } else if (modelo === "pacote") {
      const pv = num(c.pacote_valor), ph = num(c.pacote_horas) || 0, ve = num(c.valor_hora_extra) || 0;
      if (pv === null) { out.configurado = false; return out; }
      const extraMin = Math.max(0, minSemana - ph * 60);
      const extra = r2((extraMin / 60) * ve);
      out.valor = r2(pv + extra);
      out.linhas.push([`Pacote de ${fmtNum(ph)}h (valor fixo do mês)`, pv]);
      out.linhas.push([extraMin > 0 ? `${fmtDur(extraMin)} além do pacote (${fmtDec(extraMin)}) × ${moeda(ve)}` : `Horas além do pacote: nenhuma (${fmtDur(minSemana)} de ${fmtNum(ph)}h usadas${minFds ? " em dias de semana" : ""})`, extra]);
      out.extraMin = extraMin;
      linhaFds();
    } else {
      const vu = num(c.valor_unidade);
      if (vu === null) { out.configurado = false; return out; }
      const vis = visitasDe(c, ym).map((u) => visita(c, u));
      const carga = vis.filter((v) => v.carga), sem = vis.filter((v) => !v.carga);
      out.visitas = vis;
      out.quantidade = carga.reduce((s, v) => s + v.qtd, 0);
      out.valor = r2(vis.reduce((s, v) => s + v.valor, 0));
      out.deslocamento = r2(vis.reduce((s, v) => s + v.desloc, 0));
      out.despesas = r2(vis.reduce((s, v) => s + v.despesa, 0));
      out.reembolso = r2(out.deslocamento + out.despesas);
      out.linhas.push([`${plural(out.quantidade, unidades(c))} carregado${out.quantidade === 1 ? "" : "s"} × ${moeda(vu)}`, r2(out.quantidade * vu)]);
      if (sem.length) out.linhas.push([`${sem.length} dia${sem.length === 1 ? "" : "s"} sem carregamento × ${moeda(c.valor_sem_carga)}${num(c.valor_sem_carga) === null ? " (cadastre o valor em Dados do cliente)" : ""}`, r2(sem.reduce((s, v) => s + v.valor, 0))]);

    }
    return fim(out);
  }

  const faturasDe = (c, ym) => S.dados.faturas.filter((f) => f.cliente_id === c.id && (!ym || f.mes.startsWith(ym)))
    .sort((a, b) => (b.mes + (b.nf_emitida_em || "")).localeCompare(a.mes + (a.nf_emitida_em || "")));
  const lancDe = (f) => f.lancamento_id && S.dados.lancamentos.find((l) => l.id === f.lancamento_id);
  const statusDe = (f) => (lancDe(f)?.status || f.status);
  const descricaoNF = (c, ym, k) => (c.descricao_nf || (c.modelo_cobranca === "servico" ? DESCRICAO_SERVICO : DESCRICAO_PADRAO))
    .replaceAll("{servicos}", k.servicosTxt || "").replaceAll("{competencia}", compCurta(ym)).replaceAll("{horas}", fmtDec(k.minutos)).replaceAll("{quantidade}", fmtNum(k.quantidade));

  // ------------------------------------------------------------------
  // Alertas (contrato, reajuste, mês sem nota)
  // ------------------------------------------------------------------
  function avisosCliente(c, comNome = false) {
    if (c.ativo === false) return [];
    const nome = comNome ? `<a href="#/c/${c.id}/financeiro"><b>${esc(c.nome)}</b></a>: ` : "";
    const out = [];
    if (c.fim_contrato) {
      const d = diasAte(c.fim_contrato);
      if (d < 0) out.push({ cor: "vermelho", ordem: d, html: `${nome}o contrato terminou em ${fmtData(c.fim_contrato)}. Renove ou atualize a data de fim.` });
      else if (d <= DIAS_ALERTA) out.push({ cor: d <= 7 ? "vermelho" : "amarelo", ordem: d, html: `${nome}o contrato termina ${d === 0 ? "hoje" : `em ${d} dia${d === 1 ? "" : "s"}`} (${fmtData(c.fim_contrato)}).` });
    }
    if (c.data_reajuste) {
      const d = diasAte(c.data_reajuste);
      const indice = c.indice_reajuste ? ` pelo ${esc(c.indice_reajuste)}` : "";
      const botao = ` <button class="link" data-acao="fincli-reajuste" data-cliente="${c.id}">Registrar reajuste</button>`;
      if (d < 0) out.push({ cor: "vermelho", ordem: d, html: `${nome}o reajuste${indice} venceu em ${fmtData(c.data_reajuste)}.${botao}` });
      else if (d <= DIAS_ALERTA) out.push({ cor: d <= 7 ? "vermelho" : "amarelo", ordem: d, html: `${nome}reajuste${indice} ${d === 0 ? "hoje" : `em ${d} dia${d === 1 ? "" : "s"}`} (${fmtData(c.data_reajuste)}).${botao}` });
    }
    // mês anterior com valor e sem nota
    const ant = addMes(hoje().slice(0, 7), -1);
    const k = calcMes(c, ant);
    const comecou = !c.inicio_contrato || c.inicio_contrato.slice(0, 7) <= ant;
    if (comecou && k.configurado && k.valor > 0 && (k.minutos > 0 || k.quantidade > 0 || k.servicosNF > 0 || (k.visitas || []).some((v) => v.valor > 0)) && !faturasDe(c, ant).length)
      out.push({ cor: "amarelo", ordem: 100, html: `${nome}${nomeMes(ant).toLowerCase()} fechou em ${moeda(k.valor)}: é hora de emitir a nota. <a href="#/c/${c.id}/financeiro" data-acao="fincli-ir-mes" data-mes="${ant}">Emitir nota</a>` });
    if (!comNome) out.forEach((x) => (x.html = x.html.charAt(0).toUpperCase() + x.html.slice(1)));
    return out.sort((a, b) => a.ordem - b.ordem);
  }
  const avisosGerais = () => S.dados.clientes.flatMap((c) => avisosCliente(c, true)).sort((a, b) => a.ordem - b.ordem);

  // ------------------------------------------------------------------
  // Aba Financeiro do cliente
  // ------------------------------------------------------------------
  const MODELO_TXT = { hora: "Por hora trabalhada", pacote: "Pacote mensal + hora excedente", unidade: "Por unidade", servico: "Por serviço prestado" };
  function resumoContrato(c) {
    const m = c.modelo_cobranca || "hora";
    const fds = num(c.valor_hora_fds) !== null && (m === "hora" || m === "pacote") ? ` · fim de semana ${moeda(c.valor_hora_fds)}/h` : "";
    if (m === "hora") return c.valor_hora ? `${moeda(c.valor_hora)} por hora${fds}` : "Valor da hora não cadastrado";
    if (m === "servico") return "Valor de cada serviço registrado no mês";
    if (m === "pacote") return c.pacote_valor ? `${moeda(c.pacote_valor)} por ${fmtNum(c.pacote_horas || 0)}h · hora excedente ${moeda(c.valor_hora_extra)}${fds}` : "Valor do pacote não cadastrado";
    return c.valor_unidade ? `${moeda(c.valor_unidade)} por ${unidades(c)} (na nota)${num(c.valor_sem_carga) !== null ? ` · dia sem carregamento ${moeda(c.valor_sem_carga)}` : ""}${num(c.reembolso_unidade) ? ` · deslocamento ${moeda(c.reembolso_unidade)} por visita (fora da nota)` : ""}` : "Valor por unidade não cadastrado";
  }
  const chipData = (iso) => { if (!iso) return ""; const d = diasAte(iso); return d < 0 ? `<span class="chip vencido">vencido</span>` : d <= DIAS_ALERTA ? `<span class="chip proximo">em ${d} dia${d === 1 ? "" : "s"}</span>` : ""; };

  function abaFinCliente(c) {
    // se passou pela aba Financeiro da empresa, a situação das notas pode ter mudado lá: atualiza em segundo plano
    if (S.lancSujo) {
      S.lancSujo = false;
      DB.recarregar("lancamentos").then((l) => { S.dados.lancamentos = l; if (location.hash.endsWith("/financeiro")) render(); }).catch(() => {});
    }
    const ym = S.finMes || mesTrabalhoPadrao(c);
    const k = calcMes(c, ym);
    const emAndamento = ym >= hoje().slice(0, 7);
    const quando = mesmoMes(c)
      ? (emAndamento ? `A nota destes serviços é emitida em ${mesNome(ym)} mesmo (este cliente fatura no próprio mês).` : `Serviços de ${mesNome(ym)}, nota emitida e recebida no próprio mês.`)
      : (emAndamento ? `${nomeMes(ym)} ainda está em andamento. A nota destes serviços sai em ${mesNome(addMes(ym, 1))}.` : `Serviços de ${mesNome(ym)}, nota emitida e recebida em ${mesNome(addMes(ym, 1))}.`);
    const notas = faturasDe(c, ym);
    const todas = faturasDe(c);
    const ano = ym.slice(0, 4);
    const faturadoAno = todas.filter((f) => f.mes.startsWith(ano)).reduce((s, f) => s + Number(f.valor), 0);
    const aReceber = todas.filter((f) => statusDe(f) !== "pago").reduce((s, f) => s + Number(f.valor), 0);
    const reembAReceber = todas.filter((f) => Number(f.reembolso) > 0 && f.reembolso_status !== "pago").reduce((s, f) => s + Number(f.reembolso), 0);
    const jaEmitido = notas.reduce((s, f) => s + Number(f.valor), 0);
    const servs = servicosDe(c, ym);
    const semNotaAReceber = servicosDe(c).filter((x) => x.emite_nf === false && x.status !== "pago").reduce((s, x) => s + Number(x.valor || 0), 0);
    const uns = c.modelo_cobranca === "unidade" ? S.dados.unidades.filter((u) => u.cliente_id === c.id && u.data.startsWith(ym)).sort((a, b) => a.data.localeCompare(b.data)) : [];

    return `
      <div class="fc-barra">
        <div class="mes-nav" role="group" aria-label="Mês">
          <button class="mini" data-acao="fincli-mes" data-delta="-1" aria-label="Mês anterior">‹</button>
          <strong>Serviços de ${nomeMes(ym).toLowerCase()}</strong>
          <button class="mini" data-acao="fincli-mes" data-delta="1" aria-label="Próximo mês">›</button>
        </div>
        <span class="espaco"></span>
        <a class="botao-sec" href="${NFSE_EMITIDAS}" target="_blank" rel="noopener">Notas emitidas (gov)</a>
        <button class="botao" data-acao="fincli-emitir" data-cliente="${c.id}" ${k.configurado ? "" : "disabled"}>Emitir nota dos serviços de ${mesNome(ym)}</button>
      </div>

      <div class="fc-grade">
        <section class="fc-card fc-calculo">
          <h2>${emAndamento && !mesmoMes(c) ? "Valor acumulado até agora" : "Valor a faturar"}</h2>
          <p class="fc-quando">${quando}</p>
          ${k.configurado ? `
            <dl class="fc-linhas">${k.linhas.map(([t, v]) => `<div><dt>${t}</dt><dd>${moeda(v)}</dd></div>`).join("")}</dl>
            <p class="fc-total"><span>Valor da nota</span><strong>${moeda(k.valor)}</strong></p>
            ${k.modelo === "unidade" && k.reembolso > 0 ? `<p class="fc-reemb"><span>Reembolso (fora da nota e da empresa)${k.despesas ? `: deslocamento ${moeda(k.deslocamento)} + despesas ${moeda(k.despesas)}` : ""}</span><b>${moeda(k.reembolso)}</b></p>` : ""}
            ${k.semNota > 0 ? `<p class="fc-reemb"><span>Serviços sem nota (fora da nota e da empresa)</span><b>${moeda(k.semNota)}</b></p>` : ""}
            ${k.reembolso > 0 || k.semNota > 0 ? `<p class="fc-reemb"><span>Total a receber do cliente</span><b>${moeda(k.valor + k.reembolso + k.semNota)}</b></p>` : ""}
            ${k.modelo !== "unidade" && k.modelo !== "servico" ? `<p class="dica">${fmtDur(k.minutos)} registradas na aba Horas trabalhadas em ${nomeMes(ym).toLowerCase()}.</p>` : ""}
            ${jaEmitido ? `<p class="dica">Já emitido para os serviços de ${mesNome(ym)}: ${moeda(jaEmitido)}.</p>` : ""}`
          : `<p class="vazio">Cadastre a forma de cobrança e os valores em <a href="#/c/${c.id}/dados">Dados do cliente</a> para o sistema calcular o mês.</p>`}
        </section>

        <section class="fc-card">
          <h2>Contrato</h2>
          <dl class="fc-info">
            <div><dt>Cobrança</dt><dd>${MODELO_TXT[c.modelo_cobranca || "hora"]}<br><span class="dica">${resumoContrato(c)}</span></dd></div>
            <div><dt>Início</dt><dd>${fmtData(c.inicio_contrato) || "—"}</dd></div>
            <div><dt>Fim</dt><dd>${fmtData(c.fim_contrato) || "—"} ${chipData(c.fim_contrato)}</dd></div>
            <div><dt>Reajuste</dt><dd>${c.indice_reajuste ? esc(c.indice_reajuste) : "—"}${c.data_reajuste ? ` em ${fmtData(c.data_reajuste)} ${chipData(c.data_reajuste)}` : ""}</dd></div>
          </dl>
          <p class="fc-acoes"><a class="link" href="#/c/${c.id}/dados">Editar condições</a>${c.data_reajuste ? ` · <button class="link" data-acao="fincli-reajuste" data-cliente="${c.id}">Registrar reajuste</button>` : ""}</p>
        </section>
      </div>

      ${c.modelo_cobranca === "unidade" ? `
      <section class="fc-card">
        <div class="fc-cab"><h2>Visitas e ${unidades(c)}s em ${nomeMes(ym).toLowerCase()}</h2>
          <span class="fc-botoes"><button class="botao-sec" data-acao="fincli-relatorio" data-cliente="${c.id}" ${uns.length ? "" : "disabled"}>Relatório do mês (PDF ou Word)</button>
          <button class="botao" data-acao="fincli-unidade" data-cliente="${c.id}">+ Registrar visita</button></span></div>
        ${uns.length ? `<div class="tabela-rolagem"><table class="tabela-prosp tabela-visitas"><thead><tr><th>Data</th><th>Carregamento</th><th>Informações</th><th class="dir">Valor</th><th class="dir">Deslocamento / despesas</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
          ${uns.map((u) => { const v = visita(c, u); return `<tr>
            <td>${fmtData(u.data)}</td>

            <td>${v.carga ? `<span class="chip nf">${plural(v.qtd, unidades(c))}</span>` : `<span class="chip vencido">Não houve</span>`}${u.descricao ? `<small class="card-ref">${esc(u.descricao)}</small>` : ""}</td>
            <td>${u.informacoes ? esc(u.informacoes) : `<span class="dica">—</span>`}</td>
            <td class="dir num ${!v.carga ? "valor-sem-carga" : ""}">${moeda(v.valor)}</td>
            <td class="dir num">${moeda(v.desloc)}${v.despesa ? `<small class="card-ref">+ ${moeda(v.despesa)} ${esc(u.despesa_descricao || "despesa")}</small>` : ""}</td>
            <td class="acoes-linha"><button class="link" data-acao="fincli-unidade-editar" data-id="${u.id}">Editar</button><button class="link perigo" data-acao="fincli-unidade-excluir" data-id="${u.id}">Excluir</button></td></tr>`; }).join("")}
          </tbody></table></div>` : `<p class="vazio">Nenhuma visita registrada neste mês.</p>`}
        <p class="dica">Com carregamento: ${moeda(c.valor_unidade)} por ${unidades(c)}. Sem carregamento: ${num(c.valor_sem_carga) !== null ? moeda(c.valor_sem_carga) : "cadastre o valor do dia sem carregamento em Dados do cliente"}. Deslocamento de ${moeda(c.reembolso_unidade)} por visita e despesas adicionais entram como reembolso, fora da nota.</p>
      </section>` : ""}

      <section class="fc-card">
        <div class="fc-cab"><h2>Serviços prestados em ${nomeMes(ym).toLowerCase()}</h2>
          <button class="botao-sec" data-acao="fincli-servico" data-cliente="${c.id}">+ Registrar serviço</button></div>
        ${servs.length ? `<div class="tabela-rolagem"><table class="tabela-prosp tabela-servicos"><thead><tr><th>Data</th><th>Serviço</th><th>Nota fiscal</th><th class="dir">Valor</th><th>Recebimento</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
          ${servs.map((x) => `<tr>
            <td>${fmtData(x.data)}</td>
            <td><button class="link" data-acao="fincli-servico-editar" data-id="${x.id}">${esc(x.descricao)}</button>${x.observacoes ? `<small class="card-ref">${esc(x.observacoes)}</small>` : ""}</td>
            <td>${x.emite_nf === false ? `<span class="chip semnf">Sem nota</span>` : `<span class="chip nf">Com nota</span>`}</td>
            <td class="dir num">${moeda(x.valor)}</td>
            <td>${x.emite_nf === false ? `<button class="mini ${x.status === "pago" ? "ok" : ""}" data-acao="fincli-servico-status" data-id="${x.id}" title="Clique para alternar">${x.status === "pago" ? "Recebido" : "A receber"}</button>` : `<span class="dica">Na nota de ${mesNome(ym)}</span>`}</td>
            <td class="acoes-linha"><button class="link" data-acao="fincli-servico-editar" data-id="${x.id}">Editar</button><button class="link perigo" data-acao="fincli-servico-excluir" data-id="${x.id}">Excluir</button></td>
          </tr>`).join("")}</tbody></table></div>` : `<p class="vazio">Nenhum serviço registrado neste mês.${c.modelo_cobranca === "servico" ? "" : " Use para serviços avulsos, fora da forma de cobrança do contrato."}</p>`}
        <p class="dica">Com nota: entra no valor da nota do mês e, ao emitir, no Financeiro da empresa. Sem nota: fica só aqui no cliente, fora da nota e do Financeiro da empresa.${semNotaAReceber ? ` Serviços sem nota a receber (todos os meses): <b>${moeda(semNotaAReceber)}</b>.` : ""}</p>
      </section>

      <section class="fc-card">
        <div class="fc-cab"><h2>Notas fiscais</h2>
          <p class="fc-kpis"><span>Faturado em ${ano}: <b>${moeda(faturadoAno)}</b></span><span>A receber: <b>${moeda(aReceber)}</b></span>${reembAReceber ? `<span>Reembolsos a receber: <b>${moeda(reembAReceber)}</b></span>` : ""}</p></div>
        ${todas.length ? `<div class="tabela-rolagem"><table class="tabela-prosp tabela-notas"><thead><tr><th>Serviços de</th><th>Nota</th><th>Emitida em</th><th class="dir">Valor</th>${todas.some((f) => Number(f.reembolso) > 0) ? `<th class="dir">Reembolso</th>` : ""}<th>Situação</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
          ${todas.map((f) => { const st = statusDe(f); const temReemb = todas.some((x) => Number(x.reembolso) > 0); return `<tr class="${f.mes.startsWith(ym) ? "atual" : ""}">
            <td>${compCurta(f.mes.slice(0, 7))}</td>
            <td><button class="link" data-acao="fincli-editar" data-id="${f.id}">NF ${esc(f.nf_numero || "s/ nº")}</button></td>
            <td>${fmtData(f.nf_emitida_em)}</td>
            <td class="dir num">${moeda(f.valor)}</td>
            ${temReemb ? `<td class="dir num">${Number(f.reembolso) > 0 ? `${moeda(f.reembolso)} <button class="mini" data-acao="fincli-reemb" data-id="${f.id}">${f.reembolso_status === "pago" ? "Recebido" : "A receber"}</button>` : "—"}</td>` : ""}
            <td><button class="mini ${st === "pago" ? "ok" : ""}" data-acao="fincli-status" data-id="${f.id}" title="Clique para alternar">${st === "pago" ? "Recebida" : "A receber"}</button>${f.lancamento_id ? "" : ` <span class="chip vencido" title="Sem entrada no Financeiro">sem lançamento</span>`}</td>
            <td class="acoes-linha"><button class="link perigo" data-acao="fincli-excluir" data-id="${f.id}">Excluir</button></td>
          </tr>`; }).join("")}</tbody></table></div>` : `<p class="vazio">Nenhuma nota emitida para este cliente ainda.</p>`}
        <p class="dica">Cada nota emitida aqui entra sozinha em <a href="#/financeiro/lancamentos">Financeiro › Entradas e saídas</a>, como nota de serviço. Marcar "Recebida" aqui ou lá muda nos dois lugares.</p>
      </section>`;
  }

  // ------------------------------------------------------------------
  // Emitir / editar nota
  // ------------------------------------------------------------------
  const copiar = (rot, txt) => `<div><dt>${rot}</dt><dd><span>${esc(txt)}</span> <button type="button" class="mini" data-acao="copiar" data-texto="${esc(txt)}">copiar</button></dd></div>`;

  function modalNota(c, f) {
    const novo = !f;
    const ym = novo ? (S.finMes || mesTrabalhoPadrao(c)) : f.mes.slice(0, 7);
    const cedo = novo && !mesmoMes(c) && hoje().slice(0, 7) <= ym;
    const k = calcMes(c, ym);
    const valor = novo ? k.valor : Number(f.valor);
    const unid = c.modelo_cobranca === "unidade";
    abrirModal(novo ? `Emitir nota dos serviços de ${nomeMes(ym).toLowerCase()}` : `Nota ${esc(f.nf_numero || "")}`, `
      ${cedo ? `<p class="aviso">${nomeMes(ym)} ainda não terminou. Normalmente a nota destes serviços é emitida em ${mesNome(addMes(ym, 1))}, com o mês fechado.</p>` : ""}
      ${novo ? `<dl class="fc-copiar">
        ${copiar("Tomador", c.razao_social || c.nome)}
        ${c.cnpj ? copiar("CNPJ", c.cnpj) : `<div><dt>CNPJ</dt><dd><a href="#/c/${c.id}/dados">Cadastre o CNPJ do cliente</a></dd></div>`}
        ${copiar("Valor", valor.toFixed(2).replace(".", ","))}
        ${copiar("Descrição", descricaoNF(c, ym, k))}
      </dl>
      <p class="fc-links"><a class="botao" href="${NFSE_EMISSOR}" target="_blank" rel="noopener">Abrir Emissor Nacional</a><a class="botao-sec" href="${NFSE_EMITIDAS}" target="_blank" rel="noopener">Notas emitidas</a></p>
      <h3 class="fc-sub">Depois de emitir, registre a nota aqui</h3>` : ""}
      <div class="grade-form">
        <label class="campo"><span>Nº da nota</span><input name="nf_numero" required value="${esc(f?.nf_numero || "")}"></label>
        <label class="campo"><span>Emitida em</span><input type="date" name="nf_emitida_em" required value="${f?.nf_emitida_em || hoje()}"></label>
        <label class="campo"><span>Valor da nota (R$)</span><input type="number" step="0.01" min="0" name="valor" required value="${valor.toFixed(2)}"></label>
        <label class="campo"><span>Situação</span><select name="status"><option value="pendente" ${f && statusDe(f) === "pago" ? "" : "selected"}>A receber</option><option value="pago" ${f && statusDe(f) === "pago" ? "selected" : ""}>Recebida</option></select></label>
        ${unid ? `<label class="campo"><span>Quantidade de ${unidades(c)}s</span><input type="number" step="1" min="0" name="quantidade" value="${f ? f.quantidade ?? "" : k.quantidade}"></label>
        <label class="campo"><span>Reembolso, fora da nota (R$)</span><input type="number" step="0.01" min="0" name="reembolso" value="${(f ? Number(f.reembolso) : k.reembolso).toFixed(2)}"></label>` : ""}
        <label class="campo largo"><span>Observações</span><textarea name="observacoes" rows="2">${esc(f?.observacoes || "")}</textarea></label>
      </div>
      <p class="dica">Ao salvar, a nota ${novo ? "entra" : "é atualizada"} em Financeiro › Entradas e saídas como nota de serviço${unid ? " (o reembolso não entra)" : ""}.</p>`,
    async (form) => {
      const g = (n) => form.elements[n]?.value.trim() ?? "";
      const nota = {
        nf_numero: g("nf_numero"), nf_emitida_em: g("nf_emitida_em"), valor: r2(g("valor")), status: g("status"),
        observacoes: g("observacoes") || null,
        quantidade: unid ? Number(g("quantidade") || 0) : null, reembolso: unid ? r2(g("reembolso") || 0) : 0,
      };
      const lanc = {
        tipo: "entrada", data: nota.nf_emitida_em, descricao: `NF ${nota.nf_numero} - ${c.nome} - serviços de ${compCurta(ym)}`,
        categoria: "Serviços (nota fiscal)", pessoa: c.nome, valor: nota.valor, status: nota.status,
        conta_faturamento: true, nota_fiscal: nota.nf_numero, observacoes: "Lançada pela aba Financeiro do cliente",
      };
      if (novo) {
        const l = await DB.salvar("lancamentos", lanc);
        guardarLocal("lancamentos", l);
        guardarLocal("faturas", await DB.salvar("faturas", { ...nota, cliente_id: c.id, mes: ym + "-01", minutos: k.minutos, lancamento_id: l.id }));
        toast(`Nota ${nota.nf_numero} registrada e lançada no Financeiro.`);
      } else {
        if (f.lancamento_id && lancDe(f)) guardarLocal("lancamentos", await DB.salvar("lancamentos", { id: f.lancamento_id, ...lanc }));
        else if (!f.lancamento_id) { const l = await DB.salvar("lancamentos", lanc); guardarLocal("lancamentos", l); nota.lancamento_id = l.id; }
        guardarLocal("faturas", await DB.salvar("faturas", { id: f.id, ...nota }));
        toast("Nota salva.");
      }
    });
    document.querySelector(".modal").classList.add("modal-larga");
  }

  function modalReajuste(c) {
    const m = c.modelo_cobranca || "hora";
    const fdsCampo = c.valor_hora_fds != null ? [["valor_hora_fds", "Novo valor da hora no fim de semana (R$)"]] : [];
    const campos = m === "hora" ? [["valor_hora", "Novo valor da hora (R$)"], ...fdsCampo]
      : m === "pacote" ? [["pacote_valor", "Novo valor do pacote (R$)"], ["valor_hora_extra", "Novo valor da hora excedente (R$)"], ...fdsCampo]
      : m === "servico" ? []
      : [["valor_unidade", `Novo valor por ${unidades(c)} (R$)`], ["reembolso_unidade", "Novo reembolso por unidade (R$)"]];
    const prox = c.data_reajuste ? (() => { const [a, mm, d] = c.data_reajuste.split("-"); return `${Number(a) + 1}-${mm}-${d}`; })() : "";
    abrirModal(`Reajuste de ${esc(c.nome)}`, `
      <p class="dica">Valores atuais: ${resumoContrato(c)}${c.indice_reajuste ? ` · índice ${esc(c.indice_reajuste)}` : ""}.</p>
      <div class="grade-form">
        ${campos.map(([n, r]) => `<label class="campo"><span>${r}</span><input type="number" step="0.01" min="0" name="${n}" value="${c[n] ?? ""}" required></label>`).join("")}
        <label class="campo"><span>Próximo reajuste em</span><input type="date" name="data_reajuste" value="${prox}"></label>
      </div>`,
    async (form) => {
      const dados = { id: c.id, data_reajuste: form.elements.data_reajuste.value || null };
      campos.forEach(([n]) => (dados[n] = r2(form.elements[n].value)));
      const nota = !campos.length ? `Reajuste em ${fmtData(hoje())}: valores dos serviços atualizados.` : `Reajuste em ${fmtData(hoje())}: ${resumoContrato(c)} → ${campos.map(([n, r]) => `${r.replace(/^Novo |^Nova /, "").replace(" (R$)", "")} ${moeda(dados[n])}`).join(", ")}.`;
      dados.observacoes = [c.observacoes, nota].filter(Boolean).join("\n");
      guardarLocal("clientes", await DB.salvar("clientes", dados));
      toast("Reajuste registrado.");
    });
  }

  function modalUnidade(c, u) {
    const novo = !u;
    u = u || { data: hoje(), carregamento: true, quantidade: 1 };
    const t5 = (x) => (x ? String(x).slice(0, 5) : "");
    const carga = u.carregamento !== false;
    abrirModal(novo ? "Registrar visita" : "Visita", `
      <div class="grade-form form-visita">
        <label class="campo"><span>Data</span><input type="date" name="data" value="${u.data}" required></label>
        <span></span>


        <fieldset class="largo opcoes-carga"><legend>Teve carregamento?</legend>
          <label><input type="radio" name="carregamento" value="sim" ${carga ? "checked" : ""}> Sim</label>
          <label><input type="radio" name="carregamento" value="nao" ${carga ? "" : "checked"}> Não</label>
        </fieldset>
        <label class="campo so-carga" ${carga ? "" : "hidden"}><span>Quantidade de ${unidades(c)}s</span><input type="number" step="1" min="1" name="quantidade" value="${u.quantidade || 1}"></label>
        <label class="campo so-carga" ${carga ? "" : "hidden"}><span>Identificação (nº do ${unidades(c)}…)</span><input name="descricao" value="${esc(u.descricao || "")}"></label>
        <label class="campo largo"><span>Informações</span><textarea name="informacoes" rows="3" placeholder="Ex.: Previsto 1 container – não realizado pois os produtos não atingiram a temperatura mínima de -18,0 °C. Carregamento realizado em 04/08/2026.">${esc(u.informacoes || "")}</textarea><small class="dica">Aparece na coluna "Situação" do relatório. Em dia sem carregamento, explique o motivo.</small></label>
        <label class="campo largo"><span>Despesa adicional, reembolso (descrição)</span><input name="despesa_descricao" value="${esc(u.despesa_descricao || "")}" placeholder="Ex.: aquisição de lacres, etiquetas e do produto"></label>
        <label class="campo"><span>Valor da despesa (R$)</span><input type="number" step="0.01" min="0" inputmode="decimal" name="despesa_valor" value="${u.despesa_valor ?? ""}"></label>
      </div>
      <p class="previa-visita" id="previa-visita"></p>`,
    async (form) => {
      const g = (n) => form.elements[n].value.trim();
      const carga = form.elements.carregamento.value === "sim";

      if (!carga && !g("informacoes")) throw new Error("Em dia sem carregamento, preencha as informações com o motivo.");
      const dados = {
        ...(novo ? { cliente_id: c.id } : { id: u.id }),
        data: g("data"), carregamento: carga,
        quantidade: carga ? Number(g("quantidade") || 1) : 0, descricao: carga ? g("descricao") || null : null,
        informacoes: g("informacoes") || null, despesa_descricao: g("despesa_descricao") || null,
        despesa_valor: g("despesa_valor") ? r2(g("despesa_valor").replace(",", ".")) : null,
      };
      guardarLocal("unidades", await DB.salvar("unidades", dados));
      if (dados.data.slice(0, 7) !== (S.finMes || mesTrabalhoPadrao(c))) S.finMes = dados.data.slice(0, 7);
      toast(novo ? "Visita registrada." : "Visita salva.");
    },
    novo ? "" : `<button type="button" class="botao-perigo" data-acao="fincli-unidade-excluir" data-id="${u.id}">Excluir</button>`);
    // mostra na hora quanto a visita vale
    const form = document.querySelector('[data-form="modal"]');
    const previa = () => {
      const fe = form.elements, carga = fe.carregamento.value === "sim";
      form.querySelectorAll(".so-carga").forEach((l) => (l.hidden = !carga));
      const v = visita(c, { carregamento: carga, quantidade: fe.quantidade.value, despesa_valor: fe.despesa_valor.value });
      const el = document.getElementById("previa-visita");

      el.className = "previa-visita";
      el.innerHTML = `Valor do dia: <b>${moeda(v.valor)}</b> · Reembolso: <b>${moeda(v.desloc + v.despesa)}</b>`;
    };
    form.addEventListener("input", previa); form.addEventListener("change", previa); previa();
    document.querySelector(".modal").classList.add("modal-larga");
  }

  function modalServico(c, sv) {
    const novo = !sv;
    const ym = S.finMes || mesTrabalhoPadrao(c);
    // novo serviço: data de hoje se estiver vendo o mês atual, senão o último dia do mês visto
    const dataPadrao = hoje().startsWith(ym) ? hoje() : (() => { const [a, m] = ym.split("-").map(Number); return `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`; })();
    sv = sv || { data: dataPadrao, emite_nf: true, status: "pendente" };
    const faturado = !novo && sv.emite_nf !== false && faturasDe(c, sv.data.slice(0, 7)).length;
    abrirModal(novo ? "Registrar serviço prestado" : "Serviço prestado", `
      ${faturado ? `<p class="aviso">A nota dos serviços de ${mesNome(sv.data.slice(0, 7))} já foi registrada. Se mudar este serviço, confira se o valor da nota continua certo.</p>` : ""}
      <div class="grade-form">
        <label class="campo largo"><span>Serviço</span><input name="descricao" required value="${esc(sv.descricao || "")}" placeholder="Ex.: Elaboração do Manual de Boas Práticas"></label>
        <label class="campo"><span>Data</span><input type="date" name="data" required value="${sv.data}"></label>
        <label class="campo"><span>Valor (R$)</span><input type="number" step="0.01" min="0" inputmode="decimal" name="valor" required value="${sv.valor ?? ""}"></label>
        <label class="check-linha largo"><input type="checkbox" name="emite_nf" ${sv.emite_nf !== false ? "checked" : ""}>
          <span><b>Emitir nota fiscal deste serviço</b><small>Marcado: entra na nota do mês e no Financeiro da empresa. Desmarcado: fica só no cliente, fora da nota e do Financeiro da empresa.</small></span></label>
        <label class="campo"><span>Recebimento (serviços sem nota)</span><select name="status"><option value="pendente" ${sv.status !== "pago" ? "selected" : ""}>A receber</option><option value="pago" ${sv.status === "pago" ? "selected" : ""}>Recebido</option></select></label>
        <label class="campo largo"><span>Observações</span><textarea name="observacoes" rows="2">${esc(sv.observacoes || "")}</textarea></label>
      </div>
      <p class="dica">${mesmoMes(c) ? `Este cliente fatura no próprio mês: serviços de ${mesNome(ym)} entram na nota de ${mesNome(ym)}.` : `A nota segue a regra do mês seguinte: serviços de ${mesNome(ym)} entram na nota emitida em ${mesNome(addMes(ym, 1))}.`}</p>`,
    async (form) => {
      const g = (n) => form.elements[n].value.trim();
      const dados = {
        ...(novo ? { cliente_id: c.id } : { id: sv.id }),
        descricao: g("descricao"), data: g("data"), valor: r2(g("valor").replace(",", ".")),
        emite_nf: form.elements.emite_nf.checked, status: g("status"), observacoes: g("observacoes") || null,
      };
      guardarLocal("servicos", await DB.salvar("servicos", dados));
      if (dados.data.slice(0, 7) !== ym) S.finMes = dados.data.slice(0, 7);
      toast(novo ? `Serviço registrado ${dados.emite_nf ? "(com nota)" : "(sem nota)"}.` : "Serviço salvo.");
    },
    novo ? "" : `<button type="button" class="botao-perigo" data-acao="fincli-servico-excluir" data-id="${sv.id}">Excluir</button>`);
  }

  // ------------------------------------------------------------------
  // Relatório de atividade (visitas de container), no modelo usado pela Isadora
  // ------------------------------------------------------------------
  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function dadosRelatorio(c, ym) {
    const k = calcMes(c, ym);
    const vis = k.visitas || [];
    const nomeU = unidades(c);
    const comSituacao = vis.some((v) => (v.u.informacoes || "").trim()); // a coluna só aparece se houve alguma situação no mês
    const cab = ["Data", ...(comSituacao ? ["Situação"] : []), `Quantidade de ${nomeU}s`, `Valor ${nomeU}`, `Deslocamento${c.deslocamento_descricao ? `\n(${c.deslocamento_descricao})` : ""}`];
    const linhas = vis.map((v) => ({ semCarga: !v.carga, cel: [fmtData(v.u.data), ...(comSituacao ? [(v.u.informacoes || "").trim() || "-"] : []), v.carga ? fmtNum(v.qtd) : "-", moeda(v.valor), moeda(v.desloc)] }));
    return {
      k, comSituacao, cab, linhas, nCol: cab.length,
      despesas: vis.filter((v) => v.despesa > 0).map((v) => [`Despesa adicional: ${v.u.despesa_descricao || "sem descrição"} (${fmtData(v.u.data)})`, moeda(v.despesa)]),
      totalQtd: fmtNum(k.quantidade), totalValor: moeda(k.valor), totalReemb: moeda(k.reembolso || 0),
    };
  }
  const nomeRel = (c, ym, ext) => `Relatório de atividade - ${c.nome} - ${nomeMes(ym)}.${ext}`.replace(/[\\/:*?"<>|]/g, "-");

  function modalRelatorio(c) {
    const meses = [...new Set(visitasDe(c).map((u) => u.data.slice(0, 7)))].sort().reverse();
    const ini = meses.includes(S.finMes || mesTrabalhoPadrao(c)) ? (S.finMes || mesTrabalhoPadrao(c)) : meses[0];
    abrirModal("Relatório de atividade", `
      <label class="campo"><span>Mês</span><select id="rel-mes">${meses.map((m) => `<option value="${m}" ${m === ini ? "selected" : ""}>${nomeMes(m)}</option>`).join("")}</select></label>
      <p class="extrato-resumo" id="rel-resumo"></p>
      <div class="extrato-botoes">
        <button type="button" class="botao" data-acao="fincli-relatorio-baixar" data-formato="pdf" data-cliente="${c.id}">Baixar PDF</button>
        <button type="button" class="botao-sec" data-acao="fincli-relatorio-baixar" data-formato="docx" data-cliente="${c.id}">Baixar Word</button>
      </div>`, null);
    const sel = document.getElementById("rel-mes");
    const resumo = () => { const d = dadosRelatorio(c, sel.value); document.getElementById("rel-resumo").innerHTML = `${d.linhas.length} visita${d.linhas.length === 1 ? "" : "s"}, ${d.totalQtd} ${unidades(c)}${d.k.quantidade === 1 ? "" : "s"} carregado${d.k.quantidade === 1 ? "" : "s"}. Total ${unidades(c)}s <b>${d.totalValor}</b> · total reembolso <b>${d.totalReemb}</b>.`; };
    sel.addEventListener("change", resumo); resumo();
  }

  // Mesmo visual do extrato de horas: faixa laranja, logo à direita, resumo e tabela com cabeçalho escuro
  const LARANJA = [226, 102, 26], TINTA = [30, 43, 39], CINZA = [86, 100, 94], VERMELHO = [192, 57, 43];
  async function relatorioPDF(c, ym) {
    const { carregarScript, baixar, carregarLogo } = SIS.rel;
    if (!window.jspdf) await carregarScript("vendor/jspdf.umd.min.js");
    if (!window.jspdf.jsPDF.API.autoTable) await carregarScript("vendor/jspdf.plugin.autotable.min.js");
    const d = dadosRelatorio(c, ym), logo = await carregarLogo();
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(...LARANJA); doc.rect(0, 0, W, 4, "F");
    if (logo) doc.addImage(logo.url, "JPEG", W - 15 - 30, 9, 30, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...LARANJA);
    doc.text("Consultoria Isadora Andrade", 15, 16);
    doc.setFontSize(19); doc.setTextColor(...TINTA);
    doc.text("Relatório de atividade", 15, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...CINZA);
    let y = 35;
    const info = [["Cliente", c.razao_social || c.nome], ...(c.cnpj ? [["CNPJ", c.cnpj]] : []), ["Período", nomeMes(ym)]];
    info.forEach(([k, v]) => { doc.setFont("helvetica", "bold"); doc.text(k + ":", 15, y); doc.setFont("helvetica", "normal"); doc.text(String(v), 35, y); y += 6; });
    y += 2;
    doc.setFillColor(253, 238, 226); doc.roundedRect(15, y, W - 30, 14, 2, 2, "F");
    doc.setFontSize(11); doc.setTextColor(...TINTA); doc.setFont("helvetica", "bold");
    doc.text(`Total ${unidades(c)}s: ${d.totalValor}`, 20, y + 9);
    doc.text(`Total reembolso: ${d.totalReemb}`, W - 20, y + 9, { align: "right" });
    y += 20;
    const n = d.nCol, iValor = n - 2, iDesl = n - 1;
    const body = d.linhas.length ? d.linhas.map((l) => l.cel.map((v, i) => (i === iValor && l.semCarga ? { content: v, styles: { textColor: VERMELHO } } : v)))
      : [[{ content: "Nenhuma visita registrada neste mês.", colSpan: n, styles: { halign: "center", textColor: CINZA } }]];
    d.despesas.forEach(([desc, v]) => body.push([{ content: desc, colSpan: n - 1, styles: { fontStyle: "italic" } }, v]));
    const foot = [["Total", ...(d.comSituacao ? [""] : []), d.totalQtd, d.totalValor, d.totalReemb]];
    const larg = d.comSituacao ? { 0: { cellWidth: 22 }, 2: { cellWidth: 25, halign: "center" }, 3: { cellWidth: 27, halign: "right" }, 4: { cellWidth: 36, halign: "right" } }
      : { 0: { cellWidth: 40 }, 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } };
    doc.autoTable({
      startY: y, head: [d.cab], body, foot,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9.5, cellPadding: 2.4, textColor: TINTA, lineColor: [220, 226, 222], lineWidth: 0.2, valign: "top" },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: "bold", valign: "middle" },
      footStyles: { fillColor: [242, 244, 242], textColor: TINTA, fontStyle: "bold" },
      columnStyles: larg,
      didParseCell: (h) => { if ((h.section === "head" || h.section === "foot") && h.column.index >= n - (d.comSituacao ? 3 : 3) && h.column.index > 0) h.cell.styles.halign = h.column.index === n - 3 ? "center" : "right"; },
      margin: { left: 15, right: 15, bottom: 18 },
      didDrawPage: () => {
        const H = doc.internal.pageSize.getHeight();
        doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal");
        doc.text(`Emitido em ${fmtData(hoje())}`, 15, H - 9);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - 15, H - 9, { align: "right" });
      },
    });
    let yf = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal");
    doc.text(`Valor dos ${unidades(c)}s: vai na nota fiscal. Deslocamento e despesas: reembolso, fora da nota.`, 15, yf);
    baixar(doc.output("blob"), nomeRel(c, ym, "pdf"));
  }

  async function relatorioWord(c, ym) {
    const { carregarScript, baixar, carregarLogo } = SIS.rel;
    if (!window.docx) await carregarScript("vendor/docx.iife.js");
    const X = window.docx, d = dadosRelatorio(c, ym), logo = await carregarLogo();
    const fonte = "Calibri";
    const t = (text, o = {}) => new X.TextRun({ text, font: fonte, size: o.size || 21, bold: o.bold, italics: o.it, color: o.color || "1E2B27" });
    const borda = { style: X.BorderStyle.SINGLE, size: 4, color: "DCE2DE" };
    const bordas = { top: borda, bottom: borda, left: borda, right: borda };
    const n = d.nCol, iValor = n - 2;
    const larg = d.comSituacao ? [1300, 3700, 1300, 1450, 1650] : [2200, 2200, 2400, 2600];
    const alinh = (i) => (i === 0 || (d.comSituacao && i === 1) ? X.AlignmentType.LEFT : i === n - 3 ? X.AlignmentType.CENTER : X.AlignmentType.RIGHT);
    const cel = (txt, i, o = {}) => new X.TableCell({
      width: { size: larg.slice(i, i + (o.span || 1)).reduce((a, b) => a + b, 0), type: X.WidthType.DXA }, columnSpan: o.span, borders: bordas,
      shading: o.fundo ? { type: X.ShadingType.CLEAR, color: "auto", fill: o.fundo } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: String(txt).split("\n").map((p) => new X.Paragraph({ alignment: o.span ? X.AlignmentType.LEFT : alinh(i), children: [t(p, { bold: o.bold, color: o.cor, size: 19, it: o.it })] })),
    });
    const linhaT = (vals, o = {}) => new X.TableRow({ children: vals.map((v, i) => cel(v, i, { ...o, cor: (o.corCol && o.corCol(i)) || o.cor })), tableHeader: o.cab });
    const corpo = d.linhas.length ? d.linhas.map((l) => linhaT(l.cel, { corCol: (i) => (i === iValor && l.semCarga ? "C0392B" : undefined) }))
      : [new X.TableRow({ children: [cel("Nenhuma visita registrada neste mês.", 0, { span: n })] })];
    const desp = d.despesas.map(([desc, v]) => new X.TableRow({ children: [cel(desc, 0, { span: n - 1, it: true }), cel(v, n - 1)] }));
    const tabela = new X.Table({
      width: { size: larg.reduce((a, b) => a + b, 0), type: X.WidthType.DXA }, columnWidths: larg,
      rows: [linhaT(d.cab, { cab: true, bold: true, cor: "FFFFFF", fundo: "1E2B27" }), ...corpo, ...desp,
        linhaT(["Total", ...(d.comSituacao ? [""] : []), d.totalQtd, d.totalValor, d.totalReemb], { bold: true, fundo: "F2F4F2" })],
    });
    const p = (runs, o = {}) => new X.Paragraph({ children: runs, spacing: { after: o.after ?? 80 } });
    const doc = new X.Document({
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1247, right: 1247 } } },
        footers: { default: new X.Footer({ children: [new X.Paragraph({ alignment: X.AlignmentType.RIGHT, children: [t(`Emitido em ${fmtData(hoje())} · Página `, { size: 16, color: "56645E" }), new X.TextRun({ children: [X.PageNumber.CURRENT], font: fonte, size: 16, color: "56645E" })] })] }) },
        children: [
          ...(logo ? [new X.Paragraph({ alignment: X.AlignmentType.RIGHT, spacing: { after: 0 }, children: [new X.ImageRun({ type: "jpg", data: logo.bytes, transformation: { width: 96, height: 96 } })] })] : []),
          p([t("Consultoria Isadora Andrade", { bold: true, color: "E2661A", size: 20 })]),
          p([t("Relatório de atividade", { bold: true, size: 34 })], { after: 200 }),
          p([t("Cliente: ", { bold: true }), t(c.razao_social || c.nome)]),
          ...(c.cnpj ? [p([t("CNPJ: ", { bold: true }), t(c.cnpj)])] : []),
          p([t("Período: ", { bold: true }), t(nomeMes(ym))]),
          p([t(`Total ${unidades(c)}s: ${d.totalValor}`, { bold: true })]),
          p([t(`Total reembolso: ${d.totalReemb}`, { bold: true })], { after: 240 }),
          tabela,
          new X.Paragraph({ spacing: { before: 160 }, children: [t(`Valor dos ${unidades(c)}s: vai na nota fiscal. Deslocamento e despesas: reembolso, fora da nota.`, { size: 16, color: "56645E" })] }),
        ],
      }],
    });
    baixar(await X.Packer.toBlob(doc), nomeRel(c, ym, "docx"));
  }

  // ------------------------------------------------------------------
  // Ações
  // ------------------------------------------------------------------
  const fatura = (id) => S.dados.faturas.find((f) => f.id === id);
  Object.assign(SIS.acoes, {
    "fincli-mes": (el) => { S.finMes = addMes(S.finMes || mesTrabalhoPadrao(SIS.cliente(location.hash.split("/")[2])), Number(el.dataset.delta)); render(); },
    "fincli-ir-mes": (el) => { S.finMes = el.dataset.mes; setTimeout(render, 0); },
    "fincli-emitir": (el) => modalNota(cliente(el.dataset.cliente), null),
    "fincli-editar": (el) => { const f = fatura(el.dataset.id); modalNota(cliente(f.cliente_id), f); },
    "fincli-reajuste": (el) => modalReajuste(cliente(el.dataset.cliente)),
    "fincli-unidade": (el) => modalUnidade(cliente(el.dataset.cliente)),
    "fincli-unidade-editar": (el) => { const u = S.dados.unidades.find((x) => x.id === el.dataset.id); modalUnidade(cliente(u.cliente_id), u); },
    "fincli-relatorio": (el) => modalRelatorio(cliente(el.dataset.cliente)),
    "fincli-relatorio-baixar": async (el) => {
      const c = cliente(el.dataset.cliente), ym = document.getElementById("rel-mes").value, txt = el.textContent;
      el.disabled = true; el.textContent = "Gerando…";
      try { if (el.dataset.formato === "pdf") await relatorioPDF(c, ym); else await relatorioWord(c, ym); toast("Relatório gerado."); }
      catch (e) { falha(e); } finally { el.disabled = false; el.textContent = txt; }
    },
    "fincli-servico": (el) => modalServico(cliente(el.dataset.cliente), null),
    "fincli-servico-editar": (el) => { const x = S.dados.servicos.find((y) => y.id === el.dataset.id); modalServico(cliente(x.cliente_id), x); },
    "fincli-servico-status": async (el) => {
      const x = S.dados.servicos.find((y) => y.id === el.dataset.id);
      guardarLocal("servicos", await DB.salvar("servicos", { id: x.id, status: x.status === "pago" ? "pendente" : "pago" }));
      render();
    },
    "fincli-servico-excluir": async (el) => {
      if (!confirm("Excluir este serviço?")) return;
      await DB.excluir("servicos", el.dataset.id);
      S.dados.servicos = S.dados.servicos.filter((y) => y.id !== el.dataset.id);
      fecharModal(); render(); toast("Serviço excluído.");
    },
    "fincli-unidade-excluir": async (el) => {
      if (!confirm("Excluir este registro?")) return;
      await DB.excluir("unidades", el.dataset.id);
      S.dados.unidades = S.dados.unidades.filter((u) => u.id !== el.dataset.id);
      fecharModal(); render();
    },
    "fincli-status": async (el) => {
      const f = fatura(el.dataset.id);
      const novo = statusDe(f) === "pago" ? "pendente" : "pago";
      if (f.lancamento_id && lancDe(f)) guardarLocal("lancamentos", await DB.salvar("lancamentos", { id: f.lancamento_id, status: novo }));
      guardarLocal("faturas", await DB.salvar("faturas", { id: f.id, status: novo }));
      render();
      toast(novo === "pago" ? "Nota marcada como recebida." : "Nota voltou para a receber.");
    },
    "fincli-reemb": async (el) => {
      const f = fatura(el.dataset.id);
      guardarLocal("faturas", await DB.salvar("faturas", { id: f.id, reembolso_status: f.reembolso_status === "pago" ? "pendente" : "pago" }));
      render();
    },
    "fincli-excluir": async (el) => {
      const f = fatura(el.dataset.id);
      if (!confirm(`Excluir a nota ${f.nf_numero || ""}${f.lancamento_id ? " e a entrada ligada a ela no Financeiro" : ""}? Isso não cancela a nota no Emissor Nacional.`)) return;
      if (f.lancamento_id) { await DB.excluir("lancamentos", f.lancamento_id).catch(() => {}); S.dados.lancamentos = S.dados.lancamentos.filter((l) => l.id !== f.lancamento_id); }
      await DB.excluir("faturas", f.id);
      S.dados.faturas = S.dados.faturas.filter((x) => x.id !== f.id);
      render(); toast("Nota excluída.");
    },
    copiar: async (el) => {
      try { await navigator.clipboard.writeText(el.dataset.texto); el.textContent = "copiado"; setTimeout(() => (el.textContent = "copiar"), 1500); }
      catch { toast("Não foi possível copiar. Selecione o texto e copie manualmente.", true); }
    },
  });

  Object.assign(SIS, { abaFinCliente, avisosCliente, avisosGerais, calcMes, moeda, mesAnterior: (ym) => addMes(ym, -1), mesmoMes });
})();
