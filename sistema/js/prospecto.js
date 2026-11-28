// Ficha do prospect (dados e briefing, acompanhamento, propostas) e Precificação.
// Usa as tabelas do 10_prospeccao_propostas.sql; sem elas, a ficha abre e avisa o que falta.
(() => {
  const { S, esc, toast, hoje, fmtData, abrirModal, fecharModal, guardarLocal, render, formCampos, lerCampos } = window.SIS;
  const PR = SIS.propostas;

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (v) => brl.format(Number(v) || 0);
  const nl2br = (t) => esc(t).replace(/\n/g, "<br>");
  const num = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return isFinite(x) && x > 0 ? x : 0; };
  const horasTxt = (h) => `${String(Math.round(h * 100) / 100).replace(".", ",")} h`;
  const falta = (...tabs) => tabs.some((t) => DB.faltando.has(t));
  const AVISO_SQL = `<p class="pp-aviso">Para usar esta parte, falta preparar o banco: rode o arquivo <b>10_prospeccao_propostas.sql</b> no SQL Editor do Supabase e recarregue a página.</p>`;
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); }
    catch (e) { const t = document.createElement("textarea"); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    toast("Mensagem copiada.");
  }

  const TIPOS = [["conversa", "Conversa"], ["reuniao", "Reunião"], ["ligacao", "Ligação"], ["whatsapp", "WhatsApp"], ["email", "E-mail"], ["visita", "Visita técnica"], ["proposta", "Proposta"], ["nota", "Nota"]];
  const CAMPOS_ACOMP = [
    { n: "data", r: "Data", t: "date", req: true },
    { n: "tipo", r: "Tipo", t: "select", o: TIPOS, vazio: false },
    { n: "resumo", r: "O que aconteceu", t: "textarea", req: true, linhas: 4 },
    { n: "dicas", r: "Estratégia / o que ficou combinado", t: "textarea" },
    { n: "proximos_passos", r: "Próximos passos", t: "textarea" },
  ];
  const ST_PROP = [["pronta", "Pronta para revisar", "proximo"], ["revisada", "Revisada", ""], ["enviada", "Enviada ao cliente", "ok"]];
  const chipSt = (s) => { const o = ST_PROP.find((x) => x[0] === s) || [s, s, ""]; return `<span class="chip ${o[2]}">${esc(o[1])}</span>`; };

  // simulação de RT: valor fixo pelas horas incluídas + valor de cada hora além delas (guardada em itens[0])
  const simRT = (s) => (Array.isArray(s.itens) && s.itens[0]?.rt ? s.itens[0] : null);
  const resumoSim = (s) => { const r = simRT(s); return r
    ? `RT · ${moeda(r.fixo)} por ${horasTxt(Number(r.incluidas))} no mês + ${moeda(s.valor_hora)} por hora adicional${Number(r.previstas) > Number(r.incluidas) ? ` · previsão de ${horasTxt(Number(r.previstas))}: ${moeda(s.valor_total)}` : ""}`
    : `${(s.itens || []).filter((i) => i.horas).map((i) => `${i.servico}: ${horasTxt(Number(i.horas))}`).join(" · ")} · ${moeda(s.valor_hora)}/h`; };

  const E = { propId: null, rascunho: null, rascunhoId: null };
  const acompDe = (id) => S.dados.acomp.filter((a) => a.prospect_id === id).sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criado_em || "").localeCompare(String(a.criado_em || "")));
  const propostasDe = (id) => S.dados.propostas.filter((a) => a.prospect_id === id).sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || "")));
  const simsDe = (id) => S.dados.precificacoes.filter((a) => a.prospect_id === id);

  // =====================================================================
  // FICHA
  // =====================================================================
  function telaProspecto(el, r) {
    const p = S.dados.prospects.find((x) => x.id === r.id);
    if (!p) { el.innerHTML = `<header class="topo"><h1>Prospecção</h1></header><p class="vazio">Empresa não encontrada. <a href="#/prospeccao">Voltar para a prospecção</a></p>`; return; }
    const etapa = (SIS.ETAPAS_PROSP.find((e) => e[0] === p.etapa) || [p.etapa, p.etapa])[1];
    const acomp = acompDe(p.id), props = propostasDe(p.id);
    const abas = [["dados", "Dados e briefing"], ["acompanhamento", `Acompanhamento${acomp.length ? ` (${acomp.length})` : ""}`], ["propostas", `Propostas${props.length ? ` (${props.length})` : ""}`], ["contrato", "Contrato"]];
    el.innerHTML = `
      <header class="topo">
        <p class="pp-voltar"><a href="#/prospeccao">← Prospecção</a></p>
        <div class="pp-topo"><div><h1>${esc(p.nome)}</h1>
          <p class="topo-meta"><span class="etiqueta et-${esc(p.etapa)}">${esc(etapa)}</span>${[p.tipo_produto, p.cidade].filter(Boolean).map((x) => ` · ${esc(x)}`).join("")}${p.valor_proposto ? ` · <b>${moeda(p.valor_proposto)}</b>` : ""}</p></div>
          <div class="pp-acoes">
            ${p.etapa === "fechado" && !p.cliente_id ? `<button class="botao-sec" data-acao="prosp-cliente" data-id="${p.id}">Virar cliente</button>` : ""}
            ${p.cliente_id ? `<a class="botao-sec" href="#/c/${p.cliente_id}/dados">Abrir cliente</a>` : ""}
            ${p.etapa === "fechado" ? `<a class="botao" href="#/prospecto/${p.id}/contrato">Gerar contrato</a>` : ""}
            <button class="botao-sec" data-acao="prosp-editar" data-id="${p.id}">Editar dados</button>
            <button class="${p.etapa === "fechado" ? "botao-sec" : "botao"}" data-acao="pp-nova-proposta" data-id="${p.id}">+ Nova proposta</button></div></div>
        <nav class="abas" role="tablist">${abas.map(([k, n]) => `<a role="tab" aria-selected="${r.aba === k}" class="aba ${r.aba === k ? "ativa" : ""}" href="#/prospecto/${p.id}/${k}">${n}</a>`).join("")}</nav>
      </header>
      <div data-aba></div>`;
    const box = el.querySelector("[data-aba]");
    if (r.aba === "acompanhamento") return abaAcomp(box, p, acomp);
    if (r.aba === "propostas") return abaPropostas(box, p, props);
    if (r.aba === "contrato") return SIS.contrato.abaContrato(box, p);
    return abaDados(box, p);
  }

  function abaDados(el, p) {
    const linha = (r, v) => (v ? `<div class="pp-linha"><span>${r}</span><div>${v}</div></div>` : "");
    const sims = simsDe(p.id);
    const briefing = [p.dor, p.objetivo, p.servicos_interesse, p.produtos, p.inspecao].some(Boolean);
    el.innerHTML = `
      <div class="pp-grade">
        <section class="pp-card"><h2>Contato</h2>
          ${SIS.linhasContato(p) || `<p class="sem">Sem contato cadastrado.</p>`}
          ${linha("CNPJ", esc(p.cnpj))}${linha("CNAE", esc(p.cnae))}${linha("Última abordagem", esc(p.abordagem))}
          ${linha("Próxima ação", p.proxima_acao || p.proxima_acao_data ? `${esc(p.proxima_acao || "Retomar")}${p.proxima_acao_data ? ` · ${fmtData(p.proxima_acao_data)}` : ""}` : "")}
          ${p.etapa === "perdido" ? linha("Motivo", esc(p.motivo_perda)) : ""}${linha("Observações", nl2br(p.observacoes))}
        </section>
        <section class="pp-card"><h2>Briefing</h2>
          ${!SIS.temBriefing() ? AVISO_SQL : briefing ? `${linha("Situação atual", nl2br(p.dor))}${linha("Objetivo", nl2br(p.objetivo))}${linha("Serviços de interesse", esc(p.servicos_interesse))}${linha("Produtos / linha", nl2br(p.produtos))}${linha("Registro / fiscalização", esc(p.inspecao))}`
            : `<p class="sem">Preencha em “Editar dados”: situação atual, objetivo, serviços de interesse e produtos. É o que alimenta a proposta.</p>`}
        </section>
      </div>
      <section class="pp-card pp-largo"><div class="pp-card-cab"><h2>Precificação</h2><button class="botao-sec" data-acao="pp-ir-preco" data-id="${p.id}">Abrir calculadora</button></div>
        ${sims.length ? `<ul class="pp-lista">${sims.map((s) => `<li><div><span><b>${esc(s.nome)}</b> · ${moeda(simRT(s) ? simRT(s).fixo : s.valor_total)}${simRT(s) ? "/mês" : ""}</span><small>${esc(resumoSim(s))}</small></div></li>`).join("")}</ul>`
          : `<p class="sem">Nenhuma simulação vinculada. Na calculadora, escolha esta empresa em “Vincular a uma empresa”.</p>`}
      </section>`;
  }

  function abaAcomp(el, p, lista) {
    if (falta("acomp")) { el.innerHTML = AVISO_SQL; return; }
    el.innerHTML = `<section class="pp-card pp-largo"><div class="pp-card-cab"><h2>Linha do tempo</h2><button class="botao" data-acao="pp-acomp-novo" data-id="${p.id}">+ Registro</button></div>
      ${lista.length ? `<div class="pp-tempo">${lista.map((a) => `<article class="pp-reg">
        <header><b>${esc((TIPOS.find((t) => t[0] === a.tipo) || [a.tipo, a.tipo])[1])}</b><span class="sem">${fmtData(a.data)}</span>${a.origem === "claude" ? `<span class="chip analise">Registrado pelo Claude</span>` : ""}
          <span class="espaco"></span><button class="mini" data-acao="pp-acomp-editar" data-id="${a.id}">Editar</button></header>
        <p>${nl2br(a.resumo)}</p>
        ${a.dicas ? `<div class="pp-bloco"><span>Estratégia / combinado</span>${nl2br(a.dicas)}</div>` : ""}
        ${a.proximos_passos ? `<div class="pp-bloco"><span>Próximos passos</span>${nl2br(a.proximos_passos)}</div>` : ""}
      </article>`).join("")}</div>` : `<p class="sem">Nada registrado ainda. Use “+ Registro” depois de cada conversa, reunião ou visita.</p>`}
    </section>`;
  }

  function modalAcomp(prospectId, a) {
    const novo = !a;
    a = a || { prospect_id: prospectId, data: hoje(), tipo: "conversa" };
    abrirModal(novo ? "Novo registro" : "Editar registro", formCampos(CAMPOS_ACOMP, a), async (f) => {
      const dados = { ...lerCampos(f, CAMPOS_ACOMP), prospect_id: a.prospect_id };
      if (novo) dados.origem = "manual"; else dados.id = a.id;
      guardarLocal("acomp", await DB.salvar("acomp", dados));
      toast("Registro salvo.");
    }, novo ? "" : `<button type="button" class="botao-perigo" data-acao="pp-acomp-excluir" data-id="${a.id}">Excluir</button>`);
  }

  // ---------------------------------------------------------------------
  // Propostas
  // ---------------------------------------------------------------------
  function abaPropostas(el, p, props) {
    if (falta("propostas")) { el.innerHTML = AVISO_SQL; return; }
    const atual = props.find((x) => x.id === E.propId) || props[0] || null;
    if (atual && E.rascunhoId !== atual.id) { E.rascunho = PR.normalizar(atual.conteudo); E.rascunhoId = atual.id; }
    E.propId = atual?.id || null;
    el.innerHTML = `<div class="pp-prop">
      <section class="pp-card"><h2>Propostas</h2>
        <div class="pp-botoes"><button class="botao" data-acao="pp-nova-proposta" data-id="${p.id}">+ Nova proposta</button><button class="botao-sec" data-acao="pp-claude" data-id="${p.id}">Gerar com o Claude</button></div>
        ${props.length ? `<ul class="pp-lista pp-sel">${props.map((x) => `<li class="${atual?.id === x.id ? "ativo" : ""}" data-acao="pp-sel" data-id="${x.id}" tabindex="0"><div><b>${esc(x.titulo || "Proposta")}</b>
          <small>${esc(PR.nomeModelo(x.conteudo?.modelo))} · ${fmtData(String(x.criado_em || "").slice(0, 10))}${x.origem === "claude" ? " · Claude" : ""}</small>${chipSt(x.status)}</div></li>`).join("")}</ul>`
          : `<p class="sem">Nenhuma proposta ainda. “+ Nova proposta” abre um dos seus modelos (projeto ou RT) já com o nome desta empresa: é só mudar o que for diferente.</p>`}
      </section>
      <section class="pp-card" data-ed-prop>${atual ? "" : `<p class="vazio">Crie ou selecione uma proposta.</p>`}</section>
    </div>`;
    if (!atual) return;
    const box = el.querySelector("[data-ed-prop]");
    const desenhar = () => {
      const c = E.rascunho;
      box.innerHTML = `<div class="pp-ed-cab"><input data-tit value="${esc(atual.titulo || "")}" aria-label="Título da proposta">
          <span class="chip analise pp-modelo">${esc(PR.nomeModelo(c.modelo))}</span><select data-st aria-label="Situação">${ST_PROP.map((s) => `<option value="${s[0]}" ${atual.status === s[0] ? "selected" : ""}>${s[1]}</option>`).join("")}</select></div>
        <div class="pp-botoes"><button class="botao" data-salvar>Salvar</button><button class="botao-sec" data-ver>Visualizar / Baixar PDF</button><span class="espaco"></span>
          <button class="botao-sec" data-dup>Duplicar</button><button class="botao-perigo" data-del>Excluir</button></div>
        ${PR.editorHTML(c)}
        <div class="pp-botoes pp-fim"><span class="espaco"></span><button class="botao-sec" data-ver>Visualizar / Baixar PDF</button><button class="botao" data-salvar>Salvar</button></div>`;
      const abertos = () => [...box.querySelectorAll("details.pp-sec")].map((d) => d.open);
      const ler = () => { E.rascunho = PR.lerEditor(box, E.rascunho); return E.rascunho; };
      const redesenhar = () => { const ab = abertos(), y = window.scrollY; desenhar(); box.querySelectorAll("details.pp-sec").forEach((d, i) => (d.open = ab[i])); window.scrollTo(0, y); };
      const salvar = async (silencioso = false) => {
        ler();
        const reg = await DB.salvar("propostas", { id: atual.id, conteudo: E.rascunho, titulo: box.querySelector("[data-tit]").value.trim() || atual.titulo, status: box.querySelector("[data-st]").value });
        guardarLocal("propostas", reg); Object.assign(atual, reg);
        if (reg.status === "enviada" && ["prospeccao", "conversa"].includes(p.etapa)) guardarLocal("prospects", await DB.salvar("prospects", { id: p.id, etapa: "proposta" }));
        if (!silencioso) toast("Proposta salva.");
      };
      const tentar = (fn) => async (ev) => { ev.preventDefault(); try { await fn(ev); } catch (e) { SIS.falha(e); } };
      box.querySelectorAll("[data-salvar]").forEach((b) => (b.onclick = tentar(async () => { await salvar(); render(); })));
      box.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = tentar(async () => { await salvar(true); PR.abrirProposta(E.rascunho, { nomeArquivo: box.querySelector("[data-tit]").value || `Proposta ${p.nome}` }); })));
      const add = box.querySelector("[data-add-etapa]"); if (add) add.onclick = () => { ler(); E.rascunho.etapas.push({ nome: "", descricao: "", inclui: [], entrega: [], valor: "", nota: "" }); redesenhar(); };
      box.querySelectorAll("[data-rm-etapa]").forEach((b) => (b.onclick = () => { ler(); E.rascunho.etapas.splice(Number(b.dataset.rmEtapa), 1); redesenhar(); }));
      box.querySelector("[data-logo]").onchange = tentar(async (ev) => { const arq = ev.target.files[0]; if (!arq) return; ler(); E.rascunho.logo_cliente = await PR.lerLogo(arq); redesenhar(); toast("Logo adicionada. Salve a proposta para guardar."); });
      const rm = box.querySelector("[data-logo-rm]"); if (rm) rm.onclick = () => { ler(); E.rascunho.logo_cliente = ""; redesenhar(); };
      box.querySelector("[data-dup]").onclick = tentar(async () => {
        ler();
        const reg = await DB.salvar("propostas", { prospect_id: p.id, titulo: `${atual.titulo || "Proposta"} (cópia)`, conteudo: E.rascunho, status: "pronta", origem: "manual" });
        guardarLocal("propostas", reg); E.propId = reg.id; toast("Proposta duplicada."); render();
      });
      box.querySelector("[data-del]").onclick = tentar(async () => {
        if (!confirm(`Excluir “${atual.titulo || "Proposta"}”?`)) return;
        await DB.excluir("propostas", atual.id);
        S.dados.propostas = S.dados.propostas.filter((x) => x.id !== atual.id);
        E.propId = null; E.rascunhoId = null; toast("Proposta excluída."); render();
      });
    };
    desenhar();
  }

  function escolherModelo(p) {
    if (falta("propostas")) { toast("Falta preparar o banco: rode o arquivo 10_prospeccao_propostas.sql no Supabase.", true); return; }
    abrirModal("Nova proposta", `<p class="dica">Qual modelo usar para ${esc(p.nome)}?</p>
      <div class="pp-modelos">
        <button type="button" data-acao="pp-criar-proposta" data-id="${p.id}" data-modelo="projeto"><b>Projeto</b><span>Consultoria por etapas: como posso ajudar, Método DECIDIR, etapas, investimento por etapa e rotulagem.</span></button>
        <button type="button" data-acao="pp-criar-proposta" data-id="${p.id}" data-modelo="rt"><b>Responsabilidade técnica</b><span>RT mensal: objetivos, formato de atuação, atividades, atendimento remoto e valor mensal + hora adicional.</span></button>
      </div>`, null);
  }

  async function novaProposta(p, modelo) {
    const c = PR.MODELO_PADRAO(modelo); c.cliente = p.nome;
    if (modelo === "rt") { // aproveita a simulação de RT desta empresa, se houver
      const s = simsDe(p.id).find(simRT);
      if (s) { const r = simRT(s); c.horas_incluidas = String(r.incluidas).replace(".", ","); c.valor_mensal = moeda(r.fixo); c.hora_adicional = moeda(s.valor_hora); c.formato_destaque = `Total mensal: *${c.horas_incluidas} horas presenciais* na planta industrial.`; }
    }
    const reg = await DB.salvar("propostas", { prospect_id: p.id, titulo: `Proposta ${modelo === "rt" ? "RT " : ""}${p.nome}`, conteudo: c, status: "pronta", origem: "manual" });
    guardarLocal("propostas", reg); E.propId = reg.id;
    fecharModal(); toast("Proposta criada a partir do seu modelo.");
    if (location.hash === `#/prospecto/${p.id}/propostas`) render(); else location.hash = `#/prospecto/${p.id}/propostas`;
  }

  // "Gerar com o Claude": monta a mensagem com tudo da empresa + o que muda nesta proposta
  function mensagemProposta(p, oQueMuda, modelo = "projeto") {
    const l = (r, v) => (v ? `${r}: ${String(v).trim()}\n` : "");
    const etapa = (SIS.ETAPAS_PROSP.find((e) => e[0] === p.etapa) || [p.etapa, p.etapa])[1];
    let t = `GERAR PROPOSTA ISADORA\nprospect_id: ${p.id}\nmodelo: ${modelo === "rt" ? "rt (responsabilidade técnica)" : "projeto (consultoria por etapas)"}\n\n`;
    t += `== O QUE MUDA NESTA PROPOSTA ==\n${(oQueMuda || "").trim() || "(nada informado: usar o modelo padrão com os dados abaixo)"}\n`;
    t += `\n== DADOS ==\n${l("Empresa", p.nome)}${l("Tipo de produto", p.tipo_produto)}${l("Cidade", p.cidade)}${l("Contato", p.contato)}${l("Instagram", p.instagram)}${l("Site", p.site)}${l("Etapa", etapa)}${l("Valor proposto", p.valor_proposto ? moeda(p.valor_proposto) : "")}`;
    t += `\n== BRIEFING ==\n${l("Situação atual", p.dor)}${l("Objetivo", p.objetivo)}${l("Serviços de interesse", p.servicos_interesse)}${l("Produtos / linha", p.produtos)}${l("Registro / fiscalização", p.inspecao)}${l("Observações", p.observacoes)}`;
    for (const s of simsDe(p.id).slice(0, 3)) t += `Simulação "${s.nome}": ${resumoSim(s)}${simRT(s) ? "" : ` · total ${moeda(s.valor_total)}`}${s.observacao ? ` — ${s.observacao}` : ""}\n`;
    const ac = acompDe(p.id);
    if (ac.length) {
      t += `\n== ACOMPANHAMENTO (mais recente primeiro) ==\n`;
      for (const a of ac.slice(0, 15)) t += `[${a.data} · ${a.tipo}] ${a.resumo}${a.dicas ? `\n  Combinado: ${a.dicas}` : ""}${a.proximos_passos ? `\n  Próximos passos: ${a.proximos_passos}` : ""}\n`;
    }
    t += `\nGere a proposta no modelo da Consultoria Isadora Andrade e salve no sistema, na aba Propostas desta empresa.`;
    return t;
  }

  function modalClaude(p) {
    abrirModal("Gerar proposta com o Claude", `
      <p class="dica">Escreva abaixo o que muda nesta proposta (produtos, etapas, valores, prazos, o que entra e o que sai). Depois copie a mensagem e cole no chat do Claude, no Projeto <b>M2L Digital</b>, conversa <b>Sistema Consultoria Isadora</b>. O Claude escreve a proposta no seu modelo e ela aparece aqui, na aba Propostas.</p>
      <label class="campo"><span>Modelo</span><select data-claude-modelo>${Object.keys(PR.MODELOS).map((m) => `<option value="${m}">${esc(PR.nomeModelo(m))}</option>`).join("")}</select></label>
      <label class="campo"><span>O que muda nesta proposta</span><textarea data-claude-muda rows="7" placeholder="Ex.: linha de geleias e antepastos; só as etapas 1 e 2; etapa 1 por R$ 2.000; tirar a página de rotulagem; validade de 10 dias"></textarea></label>`,
      null, `<button type="button" class="botao" data-acao="pp-claude-copiar" data-id="${p.id}">Copiar mensagem</button>`);
    document.querySelector(".modal").classList.add("modal-larga");
  }

  // =====================================================================
  // PRECIFICAÇÃO
  // =====================================================================
  const SERVICOS_PADRAO = ["Diagnóstico e visita técnica", "Direcionamento técnico e de produto", "Consultoria aplicada e treinamento (BPF)", "Rotulagem"];
  const cfg = (chave) => S.dados.config.find((c) => c.chave === chave);
  const cfgHora = () => cfg("valor_hora");
  const rtPadrao = () => ({ fixo: "", incluidas: 20, hora_extra: "", ...(cfg("rt_padrao")?.valor || {}) });
  const novoCalc = (modo = "projeto") => {
    const r = rtPadrao();
    return { id: null, modo, nome: "", prospect_id: "", valor_hora: Number(cfgHora()?.valor?.valor ?? 0) || "", observacao: "",
      itens: SERVICOS_PADRAO.map((servico) => ({ servico, horas: "" })),
      fixo: r.fixo || "", incluidas: r.incluidas || 20, hora_extra: r.hora_extra || "", previstas: "" };
  };
  let calc = null;
  // RT: valor fixo pelas horas incluídas + valor da hora para cada hora além delas
  const contaRT = (c) => { const inc = num(c.incluidas), prev = num(c.previstas) || inc, extra = Math.max(0, prev - inc); return { inc, prev, extra, total: Math.round((num(c.fixo) + extra * num(c.hora_extra)) * 100) / 100 }; };

  function telaPrecificacao(el) {
    if (falta("precificacoes", "config")) { el.innerHTML = AVISO_SQL; return; }
    const padrao = Number(cfgHora()?.valor?.valor ?? 0);
    calc ||= novoCalc();
    const rt = calc.modo === "rt";
    const sims = [...S.dados.precificacoes].sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || "")));
    const abertos = S.dados.prospects.filter((p) => p.etapa !== "perdido").sort((a, b) => a.nome.localeCompare(b.nome));
    const fixo = (it) => SERVICOS_PADRAO.includes(it.servico) && !it.livre;
    const paraQuem = `<label class="campo"><span>Para qual cliente / empresa</span><input data-nome value="${esc(calc.nome)}" placeholder="ex.: Queijos & Companhia">
            <select data-prospect><option value="">Vincular a uma empresa (opcional)</option>${abertos.map((p) => `<option value="${p.id}" ${calc.prospect_id === p.id ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>`;
    const rp = cfg("rt_padrao")?.valor;
    el.innerHTML = `<div class="pp-preco">
      <section class="pp-card"><div class="pp-card-cab"><h2>${calc.id ? "Editando simulação" : "Calculadora de preço"}</h2>${calc.id ? `<span class="chip analise">${esc(calc.nome)}</span>` : ""}</div>
        <div class="seg pp-modo" role="group" aria-label="Tipo de precificação">
          <button data-acao="pp-preco-modo" data-modo="projeto" class="${rt ? "" : "ativo"}">Projeto (horas × valor da hora)</button>
          <button data-acao="pp-preco-modo" data-modo="rt" class="${rt ? "ativo" : ""}">Responsabilidade técnica (fixo + hora adicional)</button></div>
        ${rt ? `
        <div class="grade-form">
          <label class="campo"><span>Valor fixo mensal (R$)</span><input type="number" min="0" step="0.01" inputmode="decimal" data-rt="fixo" value="${esc(calc.fixo ?? "")}" placeholder="ex.: 5300"></label>
          <label class="campo"><span>Horas incluídas no valor fixo</span><input type="number" min="0" step="0.5" inputmode="decimal" data-rt="incluidas" value="${esc(calc.incluidas ?? "")}" placeholder="20"></label>
          <label class="campo"><span>Valor de cada hora além das incluídas (R$)</span><input type="number" min="0" step="0.01" inputmode="decimal" data-rt="hora_extra" value="${esc(calc.hora_extra ?? "")}" placeholder="ex.: 125">
            <small class="pp-dica">${rp ? `Padrão salvo: ${moeda(rp.fixo)} por ${horasTxt(num(rp.incluidas))} + ${moeda(rp.hora_extra)}/h` : "Ainda sem padrão salvo"} · <a href="#" data-acao="pp-preco-padrao">salvar como padrão</a></small></label>
          <label class="campo"><span>Horas previstas no mês <small class="pp-dica">· opcional, para simular</small></span><input type="number" min="0" step="0.5" inputmode="decimal" data-rt="previstas" value="${esc(calc.previstas ?? "")}" placeholder="ex.: 26"></label>
          ${paraQuem}
        </div>
        <table class="pp-tab"><thead><tr><th>Composição do mês</th><th class="dir">Horas</th><th class="dir">Valor</th></tr></thead>
          <tbody><tr><td><b>Valor fixo</b></td><td class="dir" data-r="inc">—</td><td class="dir" data-r="vfixo">—</td></tr>
            <tr><td><b>Horas adicionais</b></td><td class="dir" data-r="extra">—</td><td class="dir" data-r="vextra">—</td></tr></tbody></table>
        <div class="pp-total"><div><span>Horas no mês</span><b data-th>0 h</b></div><div class="forte"><span>Valor do mês</span><b data-tv>R$ 0,00</b></div></div>
        <p class="dica" data-aviso></p>` : `
        <div class="grade-form">
          <label class="campo"><span>Valor da sua hora (R$)</span><input type="number" min="0" step="0.01" inputmode="decimal" data-vh value="${esc(calc.valor_hora || "")}" placeholder="ex.: 150">
            <small class="pp-dica">${padrao ? `Padrão salvo: ${moeda(padrao)}/h` : "Ainda sem valor padrão salvo"} · <a href="#" data-acao="pp-preco-padrao">salvar como padrão</a></small></label>
          ${paraQuem}
        </div>
        <table class="pp-tab"><thead><tr><th>Serviço</th><th class="dir">Horas</th><th class="dir">Valor</th><th></th></tr></thead>
          <tbody>${calc.itens.map((it, i) => `<tr><td>${fixo(it) ? `<b>${esc(it.servico)}</b>` : `<input data-serv="${i}" value="${esc(it.servico)}" placeholder="Nome do serviço" aria-label="Nome do serviço">`}</td>
            <td class="dir"><input type="number" min="0" step="0.5" inputmode="decimal" data-h="${i}" value="${esc(it.horas ?? "")}" placeholder="0" aria-label="Horas"></td>
            <td class="dir" data-v="${i}">—</td><td class="dir">${fixo(it) ? "" : `<button class="mini" data-acao="pp-preco-rm" data-i="${i}" title="Remover">×</button>`}</td></tr>`).join("")}</tbody></table>
        <button class="botao-sec" data-acao="pp-preco-add">+ Outro serviço</button>
        <div class="pp-total"><div><span>Total de horas</span><b data-th>0 h</b></div><div class="forte"><span>Valor a cobrar</span><b data-tv>R$ 0,00</b></div></div>
        <p class="dica" data-aviso></p>`}
        <label class="campo"><span>Observação</span><textarea data-obs rows="2" placeholder="ex.: inclui 2 visitas presenciais; deslocamento à parte">${esc(calc.observacao || "")}</textarea></label>
        <div class="pp-botoes pp-fim"><span class="espaco"></span><button class="botao-sec" data-acao="pp-preco-limpar">Limpar</button>
          ${calc.prospect_id ? `<button class="botao-sec" data-acao="pp-preco-aplicar">Salvar e usar na empresa</button>` : ""}
          <button class="botao" data-acao="pp-preco-salvar">${calc.id ? "Salvar alterações" : "Salvar simulação"}</button></div>
      </section>
      <section class="pp-card"><h2>Simulações salvas</h2>
        ${sims.length ? `<ul class="pp-lista">${sims.map((s) => `<li class="${calc.id === s.id ? "ativo" : ""}"><div><b>${esc(s.nome)}</b><small>${esc(resumoSim(s))} · ${fmtData(String(s.criado_em || "").slice(0, 10))}</small><span>${moeda(simRT(s) ? simRT(s).fixo : s.valor_total)}${simRT(s) ? "/mês" : ""}</span></div>
          <span class="pp-item-acoes"><button class="mini" data-acao="pp-preco-abrir" data-id="${s.id}">Abrir</button><button class="mini" data-acao="pp-preco-excluir" data-id="${s.id}">Excluir</button></span></li>`).join("")}</ul>` : `<p class="sem">Nenhuma simulação salva ainda.</p>`}
      </section></div>`;
    const calcular = () => {
      if (rt) {
        const r = contaRT(calc), q = (k) => el.querySelector(`[data-r="${k}"]`);
        q("inc").textContent = r.inc ? `até ${horasTxt(r.inc)}` : "—"; q("vfixo").textContent = num(calc.fixo) ? moeda(num(calc.fixo)) : "—";
        q("extra").textContent = r.extra ? horasTxt(r.extra) : "—"; q("vextra").textContent = r.extra ? moeda(r.extra * num(calc.hora_extra)) : "—";
        el.querySelector("[data-th]").textContent = horasTxt(r.prev);
        el.querySelector("[data-tv]").textContent = moeda(r.total);
        el.querySelector("[data-aviso]").textContent = !num(calc.fixo) ? "Preencha o valor fixo mensal." : !num(calc.hora_extra) ? "Preencha o valor da hora adicional." : !r.inc ? "" : `Dentro do pacote, a hora sai por ${moeda(num(calc.fixo) / r.inc)}. ` + (r.extra ? `${horasTxt(r.extra)} além das ${horasTxt(r.inc)}: ${moeda(num(calc.fixo))} + ${horasTxt(r.extra)} × ${moeda(num(calc.hora_extra))}.` : `Cada hora além das ${horasTxt(r.inc)} soma ${moeda(num(calc.hora_extra))}.`);
        return;
      }
      const vh = num(calc.valor_hora); let th = 0;
      calc.itens.forEach((it, i) => { const h = num(it.horas); th += h; const c = el.querySelector(`[data-v="${i}"]`); if (c) c.textContent = h ? moeda(h * vh) : "—"; });
      el.querySelector("[data-th]").textContent = horasTxt(th);
      el.querySelector("[data-tv]").textContent = moeda(th * vh);
      el.querySelector("[data-aviso]").textContent = !vh ? "Preencha o valor da sua hora para calcular o preço." : th ? `${horasTxt(th)} × ${moeda(vh)}/h` : "";
    };
    calcular();
    const vh = el.querySelector("[data-vh]"); if (vh) vh.oninput = (e) => { calc.valor_hora = e.target.value; calcular(); };
    el.querySelectorAll("[data-rt]").forEach((i) => (i.oninput = () => { calc[i.dataset.rt] = i.value; calcular(); }));
    el.querySelector("[data-nome]").oninput = (e) => { calc.nome = e.target.value; };
    el.querySelector("[data-obs]").oninput = (e) => { calc.observacao = e.target.value; };
    el.querySelector("[data-prospect]").onchange = (e) => { calc.prospect_id = e.target.value; const p = S.dados.prospects.find((x) => x.id === e.target.value); if (p && !calc.nome) calc.nome = p.nome; render(); };
    el.querySelectorAll("[data-h]").forEach((i) => (i.oninput = () => { calc.itens[i.dataset.h].horas = i.value; calcular(); }));
    el.querySelectorAll("[data-serv]").forEach((i) => (i.oninput = () => { calc.itens[i.dataset.serv].servico = i.value; }));
  }

  async function salvarCalc() {
    if (!calc.nome.trim()) { toast("Dê um nome para a simulação (cliente ou empresa).", true); return null; }
    let dados;
    if (calc.modo === "rt") {
      const r = contaRT(calc);
      if (!num(calc.fixo)) { toast("Preencha o valor fixo mensal.", true); return null; }
      if (!r.inc) { toast("Preencha as horas incluídas no valor fixo.", true); return null; }
      if (!num(calc.hora_extra)) { toast("Preencha o valor da hora adicional.", true); return null; }
      dados = { valor_hora: num(calc.hora_extra), itens: [{ rt: true, fixo: num(calc.fixo), incluidas: r.inc, previstas: r.prev }], total_horas: r.prev, valor_total: r.total };
    } else {
      const vh = num(calc.valor_hora);
      if (!vh) { toast("Preencha o valor da hora.", true); return null; }
      const itens = calc.itens.filter((it) => it.servico.trim()).map((it) => ({ servico: it.servico.trim(), horas: num(it.horas) }));
      const th = itens.reduce((s, i) => s + i.horas, 0);
      dados = { valor_hora: vh, itens, total_horas: th, valor_total: Math.round(th * vh * 100) / 100 };
    }
    const reg = await DB.salvar("precificacoes", { ...(calc.id ? { id: calc.id } : {}), nome: calc.nome.trim(), prospect_id: calc.prospect_id || null, observacao: calc.observacao || null, ...dados });
    guardarLocal("precificacoes", reg); calc.id = reg.id;
    toast("Simulação salva.");
    return reg;
  }

  // =====================================================================
  // AÇÕES
  // =====================================================================
  const prospect = (id) => S.dados.prospects.find((x) => x.id === id);
  Object.assign(SIS.acoes, {
    "pp-nova-proposta": (el) => escolherModelo(prospect(el.dataset.id)),
    "pp-criar-proposta": (el) => novaProposta(prospect(el.dataset.id), el.dataset.modelo),
    "pp-sel": (el) => { E.propId = el.dataset.id; render(); },
    "pp-claude": (el) => modalClaude(prospect(el.dataset.id)),
    "pp-claude-copiar": (el) => copiar(mensagemProposta(prospect(el.dataset.id), document.querySelector("[data-claude-muda]")?.value, document.querySelector("[data-claude-modelo]")?.value)),
    "pp-acomp-novo": (el) => modalAcomp(el.dataset.id, null),
    "pp-acomp-editar": (el) => modalAcomp(null, S.dados.acomp.find((a) => a.id === el.dataset.id)),
    "pp-acomp-excluir": async (el) => {
      if (!confirm("Excluir este registro?")) return;
      await DB.excluir("acomp", el.dataset.id);
      S.dados.acomp = S.dados.acomp.filter((a) => a.id !== el.dataset.id);
      fecharModal(); render(); toast("Registro excluído.");
    },
    "pp-ir-preco": (el) => { const p = prospect(el.dataset.id); calc = novoCalc(); calc.prospect_id = p.id; calc.nome = p.nome; SIS.abrirPrecificacao(); },
    "pp-preco-modo": (el) => { calc.modo = el.dataset.modo; render(); },
    "pp-preco-add": () => { calc.itens.push({ servico: "", horas: "", livre: true }); render(); },
    "pp-preco-rm": (el) => { calc.itens.splice(Number(el.dataset.i), 1); render(); },
    "pp-preco-limpar": () => { calc = null; render(); },
    "pp-preco-padrao": async (el, e) => {
      e.preventDefault();
      const salvarCfg = async (chave, valor) => { const atual = cfg(chave); guardarLocal("config", await DB.salvar("config", { ...(atual ? { id: atual.id } : {}), chave, valor })); };
      if (calc.modo === "rt") {
        if (!num(calc.fixo) || !num(calc.incluidas) || !num(calc.hora_extra)) return toast("Preencha o valor fixo, as horas incluídas e a hora adicional primeiro.", true);
        await salvarCfg("rt_padrao", { fixo: num(calc.fixo), incluidas: num(calc.incluidas), hora_extra: num(calc.hora_extra) });
        toast("Padrão de RT salvo.");
      } else {
        const vh = num(calc.valor_hora);
        if (!vh) return toast("Preencha o valor da hora primeiro.", true);
        await salvarCfg("valor_hora", { valor: vh });
        toast(`Valor da hora salvo: ${moeda(vh)}.`);
      }
      render();
    },
    "pp-preco-salvar": async () => { if (await salvarCalc()) render(); },
    "pp-preco-aplicar": async () => {
      const reg = await salvarCalc();
      if (!reg) return;
      const valor = simRT(reg) ? simRT(reg).fixo : reg.valor_total; // em RT, o valor proposto é o fixo mensal
      guardarLocal("prospects", await DB.salvar("prospects", { id: reg.prospect_id, valor_proposto: valor }));
      toast(`Valor proposto atualizado para ${moeda(valor)}.`);
      location.hash = `#/prospecto/${reg.prospect_id}`;
    },
    "pp-preco-abrir": (el) => {
      const s = S.dados.precificacoes.find((x) => x.id === el.dataset.id);
      const r = simRT(s);
      calc = novoCalc(r ? "rt" : "projeto");
      Object.assign(calc, { id: s.id, nome: s.nome, prospect_id: s.prospect_id || "", observacao: s.observacao || "" });
      if (r) Object.assign(calc, { fixo: r.fixo, incluidas: r.incluidas, hora_extra: s.valor_hora, previstas: Number(r.previstas) > Number(r.incluidas) ? r.previstas : "" });
      else {
        const itens = (s.itens || []).map((it) => ({ servico: it.servico, horas: it.horas || "", livre: !SERVICOS_PADRAO.includes(it.servico) }));
        for (const sp of SERVICOS_PADRAO) if (!itens.some((it) => it.servico === sp)) itens.push({ servico: sp, horas: "" });
        Object.assign(calc, { valor_hora: s.valor_hora, itens });
      }
      render(); window.scrollTo(0, 0);
    },
    "pp-preco-excluir": async (el) => {
      const s = S.dados.precificacoes.find((x) => x.id === el.dataset.id);
      if (!confirm(`Excluir a simulação “${s.nome}”?`)) return;
      await DB.excluir("precificacoes", s.id);
      S.dados.precificacoes = S.dados.precificacoes.filter((x) => x.id !== s.id);
      if (calc?.id === s.id) calc = null;
      toast("Simulação excluída."); render();
    },
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches?.('[data-acao="pp-sel"]')) e.target.click(); });

  SIS.telas.prospecto = telaProspecto;
  SIS.telaPrecificacao = telaPrecificacao;
})();
