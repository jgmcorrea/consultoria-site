// Prospecção e Laboratórios
(() => {
  const { S, esc, toast, falha, hoje, fmtData, fmtDataCurta, diasAte, abrirModal, fecharModal, guardarLocal, render, formCampos, lerCampos } = window.SIS;

  // ---------- contatos clicáveis ----------
  const digitos = (t) => String(t || "").replace(/\D/g, "");
  const linkWhats = (t) => { let d = digitos(t); if (!d) return ""; if (!d.startsWith("55")) d = "55" + d; return `https://wa.me/${d}`; };
  const linkSite = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : "https://" + u);
  const nomeInsta = (u) => { const m = String(u || "").match(/instagram\.com\/([^/?#]+)/); return m ? "@" + m[1] : u; };
  function linhasContato(x, { compacto = false } = {}) {
    const L = [];
    if (x.contato) L.push(`<li><span class="ct-rot">Contato</span>${esc(x.contato)}</li>`);
    if (x.telefone) L.push(`<li><span class="ct-rot">Telefone</span><a href="tel:+${digitos(x.telefone)}">${esc(x.telefone)}</a></li>`);
    if (x.whatsapp) L.push(`<li><span class="ct-rot">WhatsApp</span><a href="${linkWhats(x.whatsapp)}" target="_blank" rel="noopener">${esc(x.whatsapp)}</a></li>`);
    if (x.email) L.push(`<li><span class="ct-rot">E-mail</span><a href="mailto:${esc(x.email)}">${esc(x.email)}</a></li>`);
    if (x.instagram) L.push(`<li><span class="ct-rot">Instagram</span><a href="${esc(linkSite(x.instagram))}" target="_blank" rel="noopener">${esc(nomeInsta(x.instagram))}</a></li>`);
    if (x.site) L.push(`<li><span class="ct-rot">Site</span><a href="${esc(linkSite(x.site))}" target="_blank" rel="noopener">${esc(String(x.site).replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, ""))}</a></li>`);
    return L.length ? `<ul class="contatos ${compacto ? "compacto" : ""}">${L.join("")}</ul>` : "";
  }

  // =====================================================================
  // PROSPECÇÃO
  // =====================================================================
  const ETAPAS = [
    ["prospeccao", "Prospecção"],
    ["conversa", "Em conversa"],
    ["proposta", "Proposta enviada"],
    ["fechado", "Fechado"],
    ["perdido", "Frio"],
  ];
  const TIPOS = ["Açougue e Embutidos", "Ovos", "Conservas", "Laticínios", "Outro"];
  const ABORDAGENS = ["Abordagem inicial - E-mail", "2ª abordagem - WhatsApp", "3ª abordagem - Instagram", "Aguardando resposta", "Respondeu"];
  const MOTIVOS = ["Contato não encontrado", "Sem resposta", "Já possui RT", "Preço", "Sem interesse"];
  const CAMPOS_PROSP = [
    { n: "nome", r: "Empresa", req: true, full: true },
    { n: "cnpj", r: "CNPJ" }, { n: "cnae", r: "CNAE" },
    { n: "cidade", r: "Cidade" }, { n: "tipo_produto", r: "Tipo de produto", t: "select", o: TIPOS.map((t) => [t, t]) },
    { n: "contato", r: "Pessoa de contato" }, { n: "email", r: "E-mail", t: "email" },
    { n: "telefone", r: "Telefone", t: "tel" }, { n: "whatsapp", r: "WhatsApp", t: "tel" },
    { n: "instagram", r: "Instagram", ph: "https://www.instagram.com/…" }, { n: "site", r: "Site" },
    { n: "etapa", r: "Etapa do funil", t: "select", o: ETAPAS, vazio: false, padrao: "prospeccao" },
    { n: "abordagem", r: "Última abordagem", t: "select", o: ABORDAGENS.map((t) => [t, t]) },
    { n: "motivo_perda", r: "Motivo de perda (se frio)", t: "select", o: MOTIVOS.map((t) => [t, t]) },
    { n: "valor_proposto", r: "Valor proposto/mês (R$)", t: "number" },
    { n: "proxima_acao", r: "Próxima ação", ph: "Ex.: ligar para a RT" }, { n: "proxima_acao_data", r: "Data da próxima ação", t: "date" },
    { n: "observacoes", r: "Observações", t: "textarea" },
  ];
  // Briefing (colunas criadas pelo 10_prospeccao_propostas.sql)
  const CAMPOS_BRIEFING = [
    { n: "dor", r: "Situação atual / o que incomoda", t: "textarea", ph: "O que está acontecendo hoje na empresa" },
    { n: "objetivo", r: "Objetivo do cliente", t: "textarea", ph: "O que ele quer alcançar" },
    { n: "servicos_interesse", r: "Serviços de interesse", full: true, ph: "Consultoria, RT, rotulagem, treinamento de BPF…" },
    { n: "produtos", r: "Produtos / linha", t: "textarea", ph: "Ex.: caponata, pesto, patês à base de queijo" },
    { n: "inspecao", r: "Registro / fiscalização", ph: "SIF, SIE, SIM, ANVISA, ainda sem registro…" },
  ];
  const temBriefing = () => DB.demo || S.dados.prospects.some((p) => "dor" in p);
  const camposProspect = () => (temBriefing() ? [...CAMPOS_PROSP.slice(0, -1), ...CAMPOS_BRIEFING, CAMPOS_PROSP[CAMPOS_PROSP.length - 1]] : CAMPOS_PROSP);
  const P = { busca: "", tipo: "", cidade: "", modo: "quadro", aba: "funil" };
  const titulo = (n) => String(n || "");

  function filtrar() {
    const b = P.busca.trim().toLowerCase();
    return S.dados.prospects.filter((p) =>
      (!P.tipo || p.tipo_produto === P.tipo) &&
      (!P.cidade || (p.cidade || "") === P.cidade) &&
      (!b || [p.nome, p.cidade, p.cnpj, p.contato, p.email, p.observacoes].some((v) => String(v || "").toLowerCase().includes(b))));
  }

  function cartaoProspect(p) {
    const i = ETAPAS.findIndex((e) => e[0] === p.etapa);
    const atrasada = p.proxima_acao_data && !["fechado", "perdido"].includes(p.etapa) && diasAte(p.proxima_acao_data) < 0;
    const temContato = p.whatsapp || p.telefone || p.email || p.instagram;
    return `
      <article class="pcard" data-prospect="${p.id}" tabindex="0">
        <h3>${esc(titulo(p.nome))}</h3>
        <p class="pcard-meta">${[p.cidade, p.tipo_produto].filter(Boolean).map(esc).join(" · ") || "Sem cidade"}</p>
        <div class="pcard-chips">
          ${p.etapa === "perdido" && p.motivo_perda ? `<span class="chip">${esc(p.motivo_perda)}</span>` : p.abordagem ? `<span class="chip">${esc(p.abordagem)}</span>` : ""}
          ${p.proxima_acao_data && !["fechado", "perdido"].includes(p.etapa) ? `<span class="chip ${atrasada ? "vencido" : ""}">${p.proxima_acao ? esc(p.proxima_acao) + " · " : "Retomar "}${fmtDataCurta(p.proxima_acao_data)}</span>` : ""}
        </div>
        <div class="pcard-rodape">
          <span class="pcard-links">${p.whatsapp ? `<a href="${linkWhats(p.whatsapp)}" target="_blank" rel="noopener" title="WhatsApp ${esc(p.whatsapp)}">WhatsApp</a>` : ""}${!p.whatsapp && p.telefone ? `<a href="tel:+${digitos(p.telefone)}" title="${esc(p.telefone)}">Ligar</a>` : ""}${p.email ? `<a href="mailto:${esc(p.email)}" title="${esc(p.email)}">E-mail</a>` : ""}${p.instagram ? `<a href="${esc(linkSite(p.instagram))}" target="_blank" rel="noopener">Instagram</a>` : ""}${!temContato ? `<span class="sem">sem contato</span>` : ""}</span>
          <span class="pcard-mover">
            ${i > 0 && p.etapa !== "perdido" ? `<button class="mini" data-acao="prosp-mover" data-id="${p.id}" data-para="${ETAPAS[i - 1][0]}" title="Voltar para ${ETAPAS[i - 1][1]}">‹</button>` : ""}
            ${i < 3 ? `<button class="mini forte" data-acao="prosp-mover" data-id="${p.id}" data-para="${ETAPAS[i + 1][0]}" title="Avançar para ${ETAPAS[i + 1][1]}">›</button>` : ""}
            ${p.etapa === "fechado" && !p.cliente_id ? `<button class="mini forte" data-acao="prosp-cliente" data-id="${p.id}">Virar cliente</button>` : ""}
          </span>
        </div>
      </article>`;
  }

  const pilulasProsp = () => `<div class="seg pilulas-prosp" role="group" aria-label="Área da prospecção">
      <button data-acao="prosp-aba" data-aba="funil" class="${P.aba === "funil" ? "ativo" : ""}">Funil de prospecção</button>
      <button data-acao="prosp-aba" data-aba="preco" class="${P.aba === "preco" ? "ativo" : ""}">Precificação</button></div>`;

  function telaProspeccao(el) {
    if (P.aba === "preco" && SIS.telaPrecificacao) {
      el.innerHTML = `<header class="topo"><h1>Prospecção</h1><p class="topo-meta">Quanto cobrar de cada cliente, a partir do valor da sua hora</p></header>${pilulasProsp()}<div data-preco></div>`;
      SIS.telaPrecificacao(el.querySelector("[data-preco]"));
      return;
    }
    const todos = S.dados.prospects;
    const lista = filtrar();
    const abertos = todos.filter((p) => !["fechado", "perdido"].includes(p.etapa)).length;
    const cidades = [...new Set(todos.map((p) => p.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const tipos = [...new Set(todos.map((p) => p.tipo_produto).filter(Boolean))].sort();
    const ordem = (a, b) => (a.proxima_acao_data || "9999").localeCompare(b.proxima_acao_data || "9999") || a.nome.localeCompare(b.nome);
    el.innerHTML = `
      <header class="topo">
        <h1>Prospecção</h1>
        <p class="topo-meta">${abertos} empresas em andamento · ${todos.filter((p) => p.etapa === "fechado").length} fechadas · ${todos.filter((p) => p.etapa === "perdido").length} frias</p>
      </header>
      ${pilulasProsp()}
      <div class="barra-ferramentas">
        <label class="busca"><span class="sr">Buscar empresa</span><input type="search" placeholder="Buscar empresa, cidade, CNPJ…" value="${esc(P.busca)}" data-campo="prosp-busca"></label>
        <select data-campo="prosp-tipo" aria-label="Tipo de produto"><option value="">Todos os tipos</option>${tipos.map((t) => `<option ${P.tipo === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select data-campo="prosp-cidade" aria-label="Cidade"><option value="">Todas as cidades</option>${cidades.map((c) => `<option ${P.cidade === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <div class="seg" role="group" aria-label="Visualização">
          <button data-acao="prosp-modo" data-modo="quadro" class="${P.modo === "quadro" ? "ativo" : ""}">Quadro</button>
          <button data-acao="prosp-modo" data-modo="lista" class="${P.modo === "lista" ? "ativo" : ""}">Lista</button>
        </div>
        <span class="espaco"></span>
        <button class="botao" data-acao="prosp-novo">+ Nova empresa</button>
      </div>
      ${P.modo === "quadro" ? `
      <div class="funil">${ETAPAS.map(([et, nome]) => {
        const ps = lista.filter((p) => p.etapa === et).sort(ordem);
        return `<section class="funil-col funil-${et}" data-etapa="${et}">
          <header><h2>${nome}</h2><span class="secao-conta">${ps.length}</span></header>
          <div class="funil-cards">${ps.map(cartaoProspect).join("") || `<p class="trilho-vazio">Nenhuma empresa.</p>`}</div>
        </section>`;
      }).join("")}</div>` : `
      <div class="tabela-rolagem"><table class="tabela-prosp">
        <thead><tr><th>Empresa</th><th>Cidade</th><th>Tipo</th><th>Etapa</th><th>Contato</th><th>Próxima ação</th></tr></thead>
        <tbody>${lista.sort((a, b) => ETAPAS.findIndex((e) => e[0] === a.etapa) - ETAPAS.findIndex((e) => e[0] === b.etapa) || ordem(a, b)).map((p) => `
          <tr data-prospect="${p.id}" tabindex="0">
            <td><b>${esc(p.nome)}</b>${p.cnpj ? `<small class="card-ref">${esc(p.cnpj)}</small>` : ""}</td>
            <td>${esc(p.cidade || "")}</td><td>${esc(p.tipo_produto || "")}</td>
            <td><span class="etiqueta et-${p.etapa}">${ETAPAS.find((e) => e[0] === p.etapa)?.[1] || p.etapa}</span>${p.etapa === "perdido" && p.motivo_perda ? `<small class="card-ref">${esc(p.motivo_perda)}</small>` : ""}</td>
            <td class="td-contato">${[p.whatsapp && `<a href="${linkWhats(p.whatsapp)}" target="_blank" rel="noopener">${esc(p.whatsapp)}</a>`, p.telefone && !p.whatsapp && `<a href="tel:+${digitos(p.telefone)}">${esc(p.telefone)}</a>`, p.email && `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`].filter(Boolean).join("<br>") || `<span class="sem">—</span>`}</td>
            <td>${p.proxima_acao_data ? `${esc(p.proxima_acao || "")} ${fmtData(p.proxima_acao_data)}` : ""}</td>
          </tr>`).join("") || `<tr><td colspan="6" class="vazio">Nenhuma empresa com esses filtros.</td></tr>`}</tbody>
      </table></div>`}`;
    el.querySelectorAll("[data-prospect]").forEach((c) => {
      const abrir = (e) => { if (e.target.closest("a,button")) return; location.hash = `#/prospecto/${c.dataset.prospect}`; };
      c.addEventListener("click", abrir);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(e); });
    });
  }

  function modalProspect(p) {
    const novo = !p;
    p = p || { etapa: "prospeccao" };
    const CAMPOS = camposProspect();
    abrirModal(novo ? "Nova empresa" : esc(p.nome), formCampos(CAMPOS, p) + (novo ? "" : `<p class="dica">${p.clickup_id ? "Migrada do ClickUp. " : ""}Cadastrada em ${fmtData(String(p.criado_em || "").slice(0, 10)) || "—"}.</p>`),
      async (f) => {
        const dados = lerCampos(f, CAMPOS);
        if (dados.etapa !== "perdido") dados.motivo_perda = null;
        if (!novo) dados.id = p.id;
        const salvo = await DB.salvar("prospects", dados);
        guardarLocal("prospects", salvo);
        toast(novo ? "Empresa adicionada." : "Empresa salva.");
        if (novo) location.hash = `#/prospecto/${salvo.id}`;
      },
      novo ? "" : `<button type="button" class="botao-perigo" data-acao="prosp-excluir" data-id="${p.id}">Excluir</button>`);
    document.querySelector(".modal").classList.add("modal-larga");
  }

  async function virarCliente(p) {
    if (!confirm(`Criar o cliente ${p.nome} com os dados de contato da prospecção?`)) return;
    // valores da proposta de RT (enviada ou mais recente) já entram no "Contrato e cobrança" do cliente
    const rt = SIS.contrato ? SIS.contrato.daProposta(SIS.contrato.propostaBase(p)) : {};
    const horasRT = SIS.contrato ? SIS.contrato.numero(rt.horas_presenciais) + SIS.contrato.numero(rt.horas_remotas) : 0;
    const cobranca = rt.valor_mensal && horasRT ? { modelo_cobranca: "pacote", pacote_valor: rt.valor_mensal, pacote_horas: horasRT, ...(rt.hora_extra ? { valor_hora_extra: rt.hora_extra } : {}) } : {};
    const cli = await DB.salvar("clientes", {
      nome: p.nome, cnpj: p.cnpj, cidade: p.cidade, segmento: p.tipo_produto, responsavel: p.contato, email: p.email,
      telefone: p.telefone, whatsapp: p.whatsapp, observacoes: p.observacoes, ordem: S.dados.clientes.length, ativo: true, ...cobranca,
    });
    guardarLocal("clientes", cli);
    guardarLocal("prospects", await DB.salvar("prospects", { id: p.id, etapa: "fechado", cliente_id: cli.id }));
    toast(`${p.nome} agora é cliente. Confira os dados e gere o contrato.`);
    location.hash = `#/prospecto/${p.id}/contrato`;
  }

  Object.assign(SIS.acoes, {
    "prosp-novo": () => modalProspect(null),
    "prosp-modo": (el) => { P.modo = el.dataset.modo; render(); },
    "prosp-aba": (el) => { P.aba = el.dataset.aba; render(); },
    "prosp-editar": (el) => modalProspect(S.dados.prospects.find((x) => x.id === el.dataset.id)),
    "prosp-mover": async (el) => {
      const p = S.dados.prospects.find((x) => x.id === el.dataset.id);
      const para = el.dataset.para;
      guardarLocal("prospects", await DB.salvar("prospects", { id: p.id, etapa: para }));
      render();
      toast(`${p.nome}: ${ETAPAS.find((e) => e[0] === para)[1]}.`);
    },
    "prosp-cliente": (el) => virarCliente(S.dados.prospects.find((x) => x.id === el.dataset.id)),
    "prosp-excluir": async (el) => {
      if (!confirm("Excluir esta empresa da prospecção?")) return;
      await DB.excluir("prospects", el.dataset.id);
      S.dados.prospects = S.dados.prospects.filter((p) => p.id !== el.dataset.id);
      S.dados.acomp = S.dados.acomp.filter((a) => a.prospect_id !== el.dataset.id);
      S.dados.propostas = S.dados.propostas.filter((a) => a.prospect_id !== el.dataset.id);
      fecharModal(); toast("Empresa excluída.");
      if (location.hash.startsWith("#/prospecto/")) location.hash = "#/prospeccao"; else render();
    },
  });

  // =====================================================================
  // LABORATÓRIOS
  // =====================================================================
  const CATEGORIAS = ["Análise microbiológica", "Análise mais específica", "Outra"];
  const CAMPOS_LAB = [
    { n: "nome", r: "Laboratório", req: true, full: true },
    { n: "categoria", r: "Tipo de análise", t: "select", o: CATEGORIAS.map((c) => [c, c]), vazio: false, padrao: CATEGORIAS[0] },
    { n: "analises", r: "Análises que faz", ph: "Ex.: Transglutaminase, Melamina" },
    { n: "cidade", r: "Cidade" }, { n: "contato", r: "Pessoa de contato" },
    { n: "telefone", r: "Telefone", t: "tel" }, { n: "whatsapp", r: "WhatsApp", t: "tel" },
    { n: "email", r: "E-mail", t: "email" }, { n: "site", r: "Site" },
    { n: "observacoes", r: "Observações (prazos, preços, outros e-mails…)", t: "textarea", linhas: 5 },
  ];
  const L = { busca: "", cat: "" };

  function telaLaboratorios(el) {
    const b = L.busca.trim().toLowerCase();
    const lista = S.dados.labs.filter((l) => (!L.cat || l.categoria === L.cat) &&
      (!b || [l.nome, l.analises, l.cidade, l.observacoes, l.email, l.contato].some((v) => String(v || "").toLowerCase().includes(b))));
    const grupos = CATEGORIAS.map((c) => [c, lista.filter((l) => (l.categoria || "Outra") === c).sort((a, b) => a.nome.localeCompare(b.nome))]).filter(([, ls]) => ls.length);
    el.innerHTML = `
      <header class="topo">
        <h1>Laboratórios</h1>
        <p class="topo-meta">${S.dados.labs.length} laboratórios para análises de alimentos</p>
      </header>
      <div class="barra-ferramentas">
        <label class="busca"><span class="sr">Buscar laboratório</span><input type="search" placeholder="Buscar por laboratório, análise ou cidade" value="${esc(L.busca)}" data-campo="lab-busca"></label>
        <div class="seg" role="group" aria-label="Tipo de análise">
          <button data-acao="lab-cat" data-cat="" class="${!L.cat ? "ativo" : ""}">Todos</button>
          ${CATEGORIAS.slice(0, 2).map((c) => `<button data-acao="lab-cat" data-cat="${c}" class="${L.cat === c ? "ativo" : ""}">${c.replace("Análise ", "")}</button>`).join("")}
        </div>
        <span class="espaco"></span>
        <button class="botao" data-acao="lab-novo">+ Novo laboratório</button>
      </div>
      ${grupos.map(([cat, ls]) => `
        <section class="lab-grupo">
          <h2>${cat}<span class="secao-conta">${ls.length}</span></h2>
          <div class="lab-grade">${ls.map((l) => {
            const contatos = linhasContato(l);
            return `<article class="lab" data-lab="${l.id}" tabindex="0">
              <h3>${esc(l.nome)}</h3>
              ${l.cidade ? `<p class="pcard-meta">${esc(l.cidade)}</p>` : ""}
              ${l.analises ? `<div class="pcard-chips">${l.analises.split(/[,;]/).map((a) => a.trim()).filter(Boolean).map((a) => `<span class="chip analise">${esc(a)}</span>`).join("")}</div>` : ""}
              ${contatos || `<p class="sem">Sem contato cadastrado. Clique para completar.</p>`}
              ${l.observacoes ? `<p class="lab-obs">${esc(l.observacoes)}</p>` : ""}
            </article>`;
          }).join("")}</div>
        </section>`).join("") || `<p class="vazio">Nenhum laboratório encontrado.</p>`}`;
    el.querySelectorAll("[data-lab]").forEach((c) => {
      const abrir = (e) => { if (e.target.closest("a")) return; modalLab(S.dados.labs.find((l) => l.id === c.dataset.lab)); };
      c.addEventListener("click", abrir);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(e); });
    });
  }

  function modalLab(l) {
    const novo = !l;
    abrirModal(novo ? "Novo laboratório" : esc(l.nome), formCampos(CAMPOS_LAB, l || {}),
      async (f) => {
        const dados = lerCampos(f, CAMPOS_LAB);
        if (!novo) dados.id = l.id;
        guardarLocal("labs", await DB.salvar("labs", dados));
        toast(novo ? "Laboratório adicionado." : "Laboratório salvo.");
      },
      novo ? "" : `<button type="button" class="botao-perigo" data-acao="lab-excluir" data-id="${l.id}">Excluir</button>`);
    document.querySelector(".modal").classList.add("modal-larga");
  }

  Object.assign(SIS.acoes, {
    "lab-novo": () => modalLab(null),
    "lab-cat": (el) => { L.cat = el.dataset.cat; render(); },
    "lab-excluir": async (el) => {
      if (!confirm("Excluir este laboratório?")) return;
      await DB.excluir("labs", el.dataset.id);
      S.dados.labs = S.dados.labs.filter((l) => l.id !== el.dataset.id);
      fecharModal(); render(); toast("Laboratório excluído.");
    },
  });

  // filtros digitados (mantém o foco no campo depois de redesenhar)
  document.addEventListener("input", (e) => {
    const c = e.target.dataset?.campo;
    if (c !== "prosp-busca" && c !== "lab-busca") return;
    if (c === "prosp-busca") P.busca = e.target.value; else L.busca = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const novo = document.querySelector(`[data-campo="${c}"]`);
    if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
  });
  document.addEventListener("change", (e) => {
    const c = e.target.dataset?.campo;
    if (c === "prosp-tipo") { P.tipo = e.target.value; render(); }
    if (c === "prosp-cidade") { P.cidade = e.target.value; render(); }
  });

  SIS.abrirPrecificacao = () => { P.aba = "preco"; if (location.hash === "#/prospeccao") render(); else location.hash = "#/prospeccao"; };
  Object.assign(SIS, { ETAPAS_PROSP: ETAPAS, linhasContato, linkWhats, virarCliente, temBriefing });
  SIS.telas.prospeccao = telaProspeccao;
  SIS.telas.laboratorios = telaLaboratorios;
})();
