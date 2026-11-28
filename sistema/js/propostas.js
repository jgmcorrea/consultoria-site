// Propostas comerciais nos modelos da Consultoria Isadora Andrade
// (slides 16:9, abertos numa janela nova e salvos em PDF pelo navegador).
// Dois modelos: "projeto" (consultoria por etapas) e "rt" (responsabilidade técnica mensal).
// Qualquer página, menos a capa, pode ser tirada da proposta: conteudo.ocultar = { pagina: true }.
(() => {
  const { esc, toast, hoje, fmtData } = window.SIS;

  const maisDias = (n) => { const d = new Date(hoje() + "T12:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const CONTATO = () => ({ whatsapp: "47 99133-6033", email: "consultoriaisadoraandrade@gmail.com", instagram: "consultoraisadoraandrade" });

  // ---------------------------------------------------------------------
  // Modelos padrão (textos fixos da Isadora + o que muda por cliente)
  // ---------------------------------------------------------------------
  const MODELO_PROJETO = () => ({
    modelo: "projeto",
    titulo_1: "Proposta",
    titulo_2: "Comercial",
    cliente: "",
    logo_cliente: "",
    assinatura: "Isadora Andrade",
    sobre_titulo: "Isadora Andrade",
    sobre: [
      "Engenheira de Alimentos, atuo desde 2017 na indústria de alimentos, com foco em empresas sob SIF, onde a fiscalização é mais intensa e contínua.",
      "Especialista em Gestão da Qualidade, Higiene e Tecnologia de Produtos de Origem Animal, com ampla atuação em indústrias de laticínios, especialmente queijos.",
      "Mestre em Engenharia Química.",
    ],
    trajetoria_titulo: "Minha trajetória inclui:",
    trajetoria: [
      "Atuação contínua em indústrias fiscalizadas pelo SIF",
      "Condução de processos de desinterdição de empresas",
      "Atuação como auditora em redes de serviços de alimentação",
      "Participação como jurada em concursos nacionais e internacionais de queijos, como o Mundial do Queijo e o Prêmio Queijo Brasil",
    ],
    ajuda_titulo: "Como Posso Ajudar Seu projeto",
    ajuda_texto: [
      "Esta consultoria tem como objetivo viabilizar tecnicamente e operacionalmente o desenvolvimento da nova linha de produtos, respeitando a realidade da empresa e evitando decisões precipitadas.",
      "O trabalho apoia o negócio desde a tomada de decisão até a implementação orientada, garantindo mais segurança, clareza e organização ao longo do processo.",
    ],
    ajuda_chamada: "De forma prática, a consultoria busca:",
    ajuda_caixas: [
      "Avaliar a viabilidade técnica e sanitária do projeto",
      "Definir prioridades e caminhos corretos antes da execução",
      "Apoiar ajustes de produto, processo e equipe",
      "Reduzir riscos, retrabalho e investimentos equivocados",
    ],
    metodo_texto: [
      "O projeto será conduzido com base no Método DECIDIR, metodologia própria que organiza decisões antes e durante a execução, evitando erros comuns no desenvolvimento de produtos alimentares.",
      "O método é estruturado em etapas progressivas, respeitando o momento e a capacidade operacional do negócio.",
    ],
    metodo_itens: ["D - Diagnosticar", "E - Entender o produto", "C - Conceituar", "I - Indicar caminhos", "D - Definir próximos passos", "I - Implementar com acompanhamento", "R - Revisar antes de escalar"],
    etapas: [
      {
        nome: "Diagnóstico Estratégico",
        descricao: "Compreender a realidade do negócio e validar o projeto antes de qualquer desenvolvimento.",
        inclui: ["Análise do processo atual de produção", "Avaliação da estrutura de produção interna existente", "Identificação de riscos sanitários, regulatórios e operacionais", "Visita técnica ao local de produção, considerando fluxo, espaço e condições reais", "Reunir as informações dos produtos, espaço de produção, processos"],
        entrega: ["Diagnóstico estratégico do projeto", "Recomendações claras de próximos passos"],
        valor: "R$ 1.800,00", nota: "",
      },
      {
        nome: "Direcionamento Técnico e de Produto",
        descricao: "Definir quais produtos desenvolver, em qual ordem e sob quais diretrizes, antes de entrar em ajustes mais profundos de formulação e processo.",
        inclui: ["Priorização dos produtos", "Diretrizes técnicas gerais (conservação, validade esperada, tipo de embalagem)", "Orientação sobre enquadramento regulatório (ANVISA ou MAPA)", "Indicação de caminhos técnicos e tecnologias possíveis"],
        entrega: ["Conceito estruturado da linha", "Diretrizes técnicas", "Lista de exigências para viabilização do projeto"],
        valor: "R$ 2.500,00", nota: "",
      },
      {
        nome: "Consultoria técnica aplicada",
        descricao: "Apoiar a execução do projeto de forma prática e orientada, garantindo que as decisões definidas nas etapas anteriores sejam corretamente aplicadas no dia a dia da produção.",
        inclui: ["Apoio técnico na implementação dos produtos", "Orientação técnica para ajustes de receitas e processos", "Orientação para melhoria de higienização, manipulação e fluxo produtivo", "Treinamento in loco da equipe em Boas Práticas de Fabricação (BPF)", "Emissão de Certificado de Participação para os colaboradores treinados", "Indicação de parceiros técnicos (laboratórios para laudo de shelf life)", "Até 2 visitas técnicas presenciais"],
        entrega: [],
        valor: "R$ 3.000,00", nota: "ciclo de implementação (30 dias)",
      },
    ],
    investimento_titulo: "Consultoria",
    investimento_obs: "",
    rotulagem: {
      titulo: "Apoio técnico em Rotulagem",
      itens: [
        "Elaboração técnica do conteúdo de rotulagem dos produtos desenvolvidos",
        "Definição de todas as informações obrigatórias conforme legislação vigente",
        "Orientação quanto à conformidade regulatória (ANVISA ou MAPA), de acordo com o produto",
        "Contato direto com a gráfica para aprovação do design e informações no rótulo",
      ],
      valor: "R$ 500,00", unidade: "por rótulo",
    },
    fechamento_1: "Vamos construir",
    fechamento_2: "esse projeto juntos?",
    validade: maisDias(15),
    ocultar: {},
    contato: CONTATO(),
  });

  const MODELO_RT = () => ({
    modelo: "rt",
    titulo_1: "Proposta",
    titulo_2: "Responsabilidade Técnica",
    cliente: "",
    logo_cliente: "",
    assinatura: "Isadora Andrade",
    sobre_titulo: "Isadora Andrade",
    sobre: ["Engenheira de Alimentos", "Especialista em Gestão da Qualidade, Higiene e Tecnologia de Produtos de Origem Animal", "Mestre em Engenharia Química"],
    trajetoria_titulo: "Experiência em:",
    trajetoria: ["Indústrias fiscalizadas pelo SIF", "Desinterdição de empresas", "Auditorias e adequações técnicas"],
    objetivos_titulo: "Objetivos da proposta",
    objetivos: ["Conformidade com a legislação vigente", "Segurança de alimentos", "Manutenção dos Programas de Autocontrole (PAC)", "Redução de riscos técnicos e sanitários", "Padronização e melhoria contínua dos processos"],
    objetivos_destaque: "A atuação visa garantir controle técnico da planta industrial e suporte estratégico à gestão.",
    formato_titulo: "Formato de atuação",
    formato_intro: "A Responsabilidade Técnica será exercida por meio de:",
    formato_blocos: [
      { titulo: "2 visitas presenciais mensais", linhas: ["Preferencialmente na 1ª e 3ª semana de cada mês."] },
      { titulo: "Rotina de cada visita:", linhas: ["Segunda-feira: 14h às 19h (com pernoite no hotel)", "Terça-feira: 6h às 11h"] },
    ],
    formato_destaque: "Total mensal: *20 horas presenciais* na planta industrial.",
    formato_nota: "A carga horária foi estruturada com foco em acompanhamento estratégico dos pontos críticos da produção e controle dos principais riscos sanitários.",
    atividades_titulo: "Atividades contempladas",
    atividades_intro: "Durante as horas presenciais, serão realizadas:",
    atividades: ["Acompanhamento de produção e processos críticos", "Elaboração, verificação e orientação dos Programas de Autocontrole", "Análise de não conformidades e definição de ações corretivas prioritárias", "Orientação técnica à equipe", "Apoio em rotulagem, boas práticas e exigências dos órgãos de inspeção", "Treinamentos técnicos quando programados"],
    remoto_titulo: "Atendimento remoto",
    remoto_intro: "Suporte técnico pontual via telefone, mensagem ou vídeo para:",
    remoto_caixas: ["Dúvidas urgentes", "Análise rápida de documentos", "Orientações emergenciais", "Atividade extra além do período presencial na fábrica"],
    remoto_nota: "Demandas que excedam a carga horária contratada serão consideradas como hora técnica adicional.",
    // investimento: valor fixo pelas horas incluídas + valor de cada hora além delas
    rt_titulo: "Responsabilidade técnica",
    horas_incluidas: "20",
    valor_mensal: "R$ 5.300,00",
    hora_adicional: "R$ 125,00",
    investimento_obs: "",
    fechamento_1: "Vamos construir",
    fechamento_2: "esse projeto juntos?",
    validade: maisDias(15),
    ocultar: { clientes: true, fechamento: true }, // o modelo de RT não traz essas duas páginas; dá para incluir
    contato: CONTATO(),
  });

  const MODELOS = { projeto: ["Projeto / consultoria por etapas", MODELO_PROJETO], rt: ["Responsabilidade técnica (RT)", MODELO_RT] };
  const nomeModelo = (m) => (MODELOS[m] || MODELOS.projeto)[0];
  const MODELO_PADRAO = (m = "projeto") => (MODELOS[m] || MODELOS.projeto)[1]();
  const LISTAS = ["sobre", "trajetoria", "ajuda_texto", "ajuda_caixas", "metodo_texto", "metodo_itens", "objetivos", "atividades", "remoto_caixas"];

  // completa uma proposta com os campos que faltarem (propostas antigas ou geradas pelo Claude)
  function normalizar(c = {}) {
    c = c || {};
    const base = MODELO_PADRAO(c.modelo);
    const out = { ...base, ...c, modelo: base.modelo };
    for (const k of LISTAS) if (k in base && !Array.isArray(out[k])) out[k] = base[k];
    out.contato = { ...base.contato, ...(c.contato || {}) };
    out.ocultar = { ...(c.ocultar && typeof c.ocultar === "object" ? c.ocultar : base.ocultar) };
    if (out.modelo === "projeto") {
      out.rotulagem = { ...base.rotulagem, ...(c.rotulagem || {}) };
      if (!Array.isArray(out.rotulagem.itens)) out.rotulagem.itens = base.rotulagem.itens;
      out.etapas = Array.isArray(out.etapas)
        ? out.etapas.map((e) => ({ nome: e.nome || "", descricao: e.descricao || "", inclui: Array.isArray(e.inclui) ? e.inclui : [], entrega: Array.isArray(e.entrega) ? e.entrega : [], valor: e.valor || "", nota: e.nota || "" }))
        : base.etapas;
      // formato antigo das três páginas opcionais
      if (c.mostrar_clientes === false) out.ocultar.clientes = true;
      if (c.mostrar_metodo === false) out.ocultar.metodo = true;
      if (c.rotulagem && c.rotulagem.mostrar === false) out.ocultar.rotulagem = true;
      delete out.mostrar_clientes; delete out.mostrar_metodo; delete out.rotulagem.mostrar;
    } else {
      out.formato_blocos = Array.isArray(out.formato_blocos) ? out.formato_blocos.map((b) => ({ titulo: b.titulo || "", linhas: Array.isArray(b.linhas) ? b.linhas : [] })) : base.formato_blocos;
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // Editor (formulário com uma linha por item)
  // ---------------------------------------------------------------------
  const L = (a) => (a || []).join("\n");
  const P = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const um = "um item por linha";
  const blocosTxt = (bs) => (bs || []).map((b) => [b.titulo, ...b.linhas].join("\n")).join("\n\n");
  const blocosDe = (t) => String(t || "").split(/\n\s*\n/).map((b) => P(b)).filter((l) => l.length).map((l) => ({ titulo: l[0], linhas: l.slice(1) }));

  function editorHTML(c) {
    const rot = (r, dica) => `<span>${r}${dica ? ` <small class="pp-dica">· ${dica}</small>` : ""}</span>`;
    const area = (k, r, v, linhas = 3, dica = "") => `<label class="campo largo">${rot(r, dica)}<textarea data-k="${k}" rows="${linhas}">${esc(v ?? "")}</textarea></label>`;
    const txt = (k, r, v, largo = false, tipo = "text") => `<label class="campo ${largo ? "largo" : ""}">${rot(r)}<input type="${tipo}" data-k="${k}" value="${esc(v ?? "")}"></label>`;
    // "tirar esta página": marcada, a página não entra no PDF (os textos continuam guardados)
    const tira = (k, r = "Tirar esta página da proposta") => `<label class="pp-marca pp-tira largo"><input type="checkbox" data-k="oc.${k}" ${c.ocultar[k] ? "checked" : ""}> ${r}</label>`;
    const fora = (...ks) => (ks.length && ks.every((k) => c.ocultar[k]) ? ` <span class="chip">fora da proposta</span>` : "");
    const sec = (titulo, corpo, { aberto = true, ks = [] } = {}) => `<details ${aberto && !(ks.length && ks.every((k) => c.ocultar[k])) ? "open" : ""} class="pp-sec"><summary>${titulo}${fora(...ks)}</summary><div class="grade-form">${corpo}</div></details>`;

    const capa = sec("1. Capa e cliente", `
        ${txt("cliente", "Nome do cliente", c.cliente, true)}
        <div class="campo largo"><span>Logo do cliente <small class="pp-dica">· opcional; sem logo, a capa mostra o nome</small></span>
          <div class="pp-logo">${c.logo_cliente ? `<img src="${esc(c.logo_cliente)}" alt="Logo do cliente">` : `<span class="sem">Sem logo</span>`}
            <label class="botao-sec pp-arquivo">Escolher imagem<input type="file" accept="image/*" data-logo hidden></label>
            ${c.logo_cliente ? `<button type="button" class="botao-perigo" data-logo-rm>Remover</button>` : ""}</div></div>
        ${txt("titulo_1", "Título (linha 1)", c.titulo_1)}${txt("titulo_2", "Título (linha 2, em negrito)", c.titulo_2)}
        ${txt("validade", "Proposta válida até", c.validade, false, "date")}${txt("assinatura", "Assinatura da capa", c.assinatura)}`);
    const fixos = (n) => sec(`${n}. Quem é a Isadora`, `
        ${tira("sobre")}
        ${txt("sobre_titulo", "Título", c.sobre_titulo, true)}
        ${area("sobre", "Apresentação", L(c.sobre), 4, um)}
        ${txt("trajetoria_titulo", "Chamada da segunda lista", c.trajetoria_titulo, true)}
        ${area("trajetoria", "Segunda lista", L(c.trajetoria), 4, um)}`, { aberto: false, ks: ["sobre"] })
      + sec(`${n + 1}. Clientes, fechamento e contato`, `
        ${tira("clientes", "Tirar a página “Alguns dos nomes que já confiaram no meu trabalho”")}
        ${tira("fechamento", "Tirar a página de fechamento (“Vamos construir esse projeto juntos?” + validade)")}
        ${txt("fechamento_1", "Fechamento (linha branca)", c.fechamento_1)}${txt("fechamento_2", "Fechamento (linha escura)", c.fechamento_2)}
        ${tira("contato", "Tirar a página de contato")}
        ${txt("con.whatsapp", "WhatsApp", c.contato.whatsapp)}${txt("con.email", "E-mail", c.contato.email)}${txt("con.instagram", "Instagram", c.contato.instagram)}`, { aberto: false });

    if (c.modelo === "rt") return `
    <div class="pp-editor">
      ${capa}
      ${sec("2. Objetivos da proposta", `
        ${tira("objetivos")}
        ${txt("objetivos_titulo", "Título", c.objetivos_titulo, true)}
        ${area("objetivos", "Objetivos", L(c.objetivos), 5, um)}
        ${area("objetivos_destaque", "Faixa azul", c.objetivos_destaque, 2)}`, { ks: ["objetivos"] })}
      ${sec("3. Formato de atuação", `
        ${tira("formato")}
        ${txt("formato_titulo", "Título", c.formato_titulo, true)}
        ${txt("formato_intro", "Abertura", c.formato_intro, true)}
        ${area("formato_blocos", "Blocos com seta", blocosTxt(c.formato_blocos), 7, "a 1ª linha de cada bloco é o título; separe os blocos com uma linha em branco")}
        ${area("formato_destaque", "Faixa azul", c.formato_destaque, 2, "o que estiver entre *asteriscos* sai em negrito")}
        ${area("formato_nota", "Texto final", c.formato_nota, 3)}`, { ks: ["formato"] })}
      ${sec("4. Atividades contempladas", `
        ${tira("atividades")}
        ${txt("atividades_titulo", "Título", c.atividades_titulo, true)}
        ${txt("atividades_intro", "Abertura", c.atividades_intro, true)}
        ${area("atividades", "Atividades", L(c.atividades), 6, um)}`, { ks: ["atividades"] })}
      ${sec("5. Atendimento remoto", `
        ${tira("remoto")}
        ${txt("remoto_titulo", "Título", c.remoto_titulo, true)}
        ${txt("remoto_intro", "Abertura", c.remoto_intro, true)}
        ${area("remoto_caixas", "Caixas", L(c.remoto_caixas), 4, um)}
        ${area("remoto_nota", "Texto final", c.remoto_nota, 2)}`, { ks: ["remoto"] })}
      ${sec("6. Investimento", `
        ${tira("investimento")}
        ${txt("rt_titulo", "Título", c.rt_titulo, true)}
        ${txt("horas_incluidas", "Horas presenciais incluídas no mês", c.horas_incluidas)}
        ${txt("valor_mensal", "Valor mensal (fixo, pelas horas incluídas)", c.valor_mensal)}
        ${txt("hora_adicional", "Valor de cada hora além das incluídas", c.hora_adicional)}
        ${txt("investimento_obs", "Observação abaixo dos valores", c.investimento_obs)}
        <p class="dica largo">Se mudar as horas incluídas, ajuste também a faixa azul do bloco 3 (“Total mensal…”).</p>`, { ks: ["investimento"] })}
      ${fixos(7)}
    </div>`;

    return `
    <div class="pp-editor">
      ${capa}
      ${sec("2. Como posso ajudar", `
        ${tira("ajuda")}
        ${txt("ajuda_titulo", "Título", c.ajuda_titulo, true)}
        ${area("ajuda_texto", "Texto de abertura", L(c.ajuda_texto), 6, "um parágrafo por linha")}
        ${txt("ajuda_chamada", "Chamada das caixas", c.ajuda_chamada, true)}
        ${area("ajuda_caixas", "Caixas (até 4)", L(c.ajuda_caixas), 4, um)}`, { ks: ["ajuda"] })}
      <details open class="pp-sec"><summary>3. Como o projeto é executado (etapas)${fora("geral", "etapas")}</summary>
        <div class="grade-form pp-tiras">${tira("geral", "Tirar a página com a visão geral das etapas")}${tira("etapas", "Tirar as páginas de detalhe das etapas")}</div>
        <div data-etapas>${c.etapas.map((e, i) => `<div class="pp-etapa" data-etapa="${i}">
          <div class="pp-etapa-cab"><b>Etapa ${i + 1}</b><button type="button" class="botao-perigo" data-rm-etapa="${i}">Remover</button></div>
          <div class="grade-form">
            <label class="campo largo"><span>Nome da etapa</span><input data-e="nome" value="${esc(e.nome)}"></label>
            <label class="campo largo"><span>O que é</span><textarea data-e="descricao" rows="2">${esc(e.descricao)}</textarea></label>
            <label class="campo"><span>Inclui <small class="pp-dica">· ${um}</small></span><textarea data-e="inclui" rows="6">${esc(L(e.inclui))}</textarea></label>
            <label class="campo"><span>Entrega <small class="pp-dica">· ${um}; pode ficar vazio</small></span><textarea data-e="entrega" rows="6">${esc(L(e.entrega))}</textarea></label>
            <label class="campo"><span>Investimento</span><input data-e="valor" value="${esc(e.valor)}" placeholder="R$ 0,00"></label>
            <label class="campo"><span>Linha abaixo do valor</span><input data-e="nota" value="${esc(e.nota)}" placeholder="ex.: ciclo de implementação (30 dias)"></label>
          </div></div>`).join("")}</div>
        <button type="button" class="botao-sec" data-add-etapa>+ Etapa</button>
      </details>
      ${sec("4. Investimento", `
        ${tira("investimento")}
        ${txt("investimento_titulo", "Título (antes de “- Investimento”)", c.investimento_titulo)}
        ${txt("investimento_obs", "Observação abaixo dos valores", c.investimento_obs)}
        <p class="dica largo">Os valores vêm de cada etapa, no bloco 3.</p>`, { ks: ["investimento"] })}
      ${sec("5. Apoio técnico em rotulagem", `
        ${tira("rotulagem")}
        ${txt("rot.titulo", "Título", c.rotulagem.titulo, true)}
        ${area("rot.itens", "Itens", L(c.rotulagem.itens), 5, um)}
        ${txt("rot.valor", "Investimento", c.rotulagem.valor)}${txt("rot.unidade", "Unidade", c.rotulagem.unidade)}`, { ks: ["rotulagem"] })}
      ${sec("6. Método DECIDIR", `
        ${tira("metodo")}
        ${area("metodo_texto", "Texto", L(c.metodo_texto), 5, "um parágrafo por linha")}
        ${area("metodo_itens", "Estrutura", L(c.metodo_itens), 7, "uma linha por letra, no formato “D - Diagnosticar”")}`, { aberto: false, ks: ["metodo"] })}
      ${fixos(7)}
    </div>`;
  }

  // lê o editor de volta para o objeto da proposta
  function lerEditor(el, c) {
    const out = normalizar(JSON.parse(JSON.stringify(c)));
    el.querySelectorAll("[data-k]").forEach((i) => {
      const k = i.dataset.k;
      const v = i.type === "checkbox" ? i.checked : i.value;
      if (k.startsWith("oc.")) { if (v) out.ocultar[k.slice(3)] = true; else delete out.ocultar[k.slice(3)]; }
      else if (k.startsWith("rot.")) { const kk = k.slice(4); out.rotulagem[kk] = kk === "itens" ? P(v) : v.trim(); }
      else if (k.startsWith("con.")) out.contato[k.slice(4)] = v.trim();
      else if (k === "formato_blocos") out.formato_blocos = blocosDe(v);
      else out[k] = LISTAS.includes(k) ? P(v) : v.trim();
    });
    if (out.modelo === "projeto") out.etapas = [...el.querySelectorAll("[data-etapa]")].map((d) => {
      const g = (n) => d.querySelector(`[data-e="${n}"]`).value;
      return { nome: g("nome").trim(), descricao: g("descricao").trim(), inclui: P(g("inclui")), entrega: P(g("entrega")), valor: g("valor").trim(), nota: g("nota").trim() };
    });
    return out;
  }

  // reduz a imagem escolhida (logo do cliente) para caber no registro da proposta
  function lerLogo(arquivo) {
    return new Promise((ok, erro) => {
      const fr = new FileReader();
      fr.onerror = () => erro(new Error("Não foi possível ler a imagem."));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => erro(new Error("Esse arquivo não é uma imagem que o navegador consiga abrir."));
        img.onload = () => {
          const f = Math.min(1, 520 / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.round(img.width * f); cv.height = Math.round(img.height * f);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          ok(cv.toDataURL("image/png"));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(arquivo);
    });
  }

  // ---------------------------------------------------------------------
  // Slides
  // ---------------------------------------------------------------------
  const COR = "#D66244", ESCURO = "#2B2B2B", AZUL = "#1C4587";
  const lista = (a) => `<ul>${(a || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const negrito = (t) => esc(t).replace(/\*([^*]+)\*/g, "<b>$1</b>");
  // título em duas cores: n palavras escuras e o resto na cor da marca (ou o contrário, com inv)
  const duo = (t, n = 2, inv = false) => { const p = String(t || "").trim().split(/\s+/); const a = esc(p.slice(0, n).join(" ")), b = esc(p.slice(n).join(" ")); return inv ? `<span class="c">${a}</span> ${b}` : `${a} <span class="c">${b}</span>`; };

  function slidesHTML(conteudo, base = location.href) {
    const c = normalizar(conteudo);
    const u = (f) => new URL(f, base).href;
    const logo = u("img/proposta/logo.png");
    const selo = `<img class="selo" src="${logo}" alt="">`;
    const barra = `<div class="barra"></div>`;
    const s = [];
    const pag = (k, html) => { if (!c.ocultar[k]) s.push(html); };

    // capa (sempre entra)
    s.push(`<section class="s capa ${String(c.titulo_2).length > 14 ? "capa-longa" : ""}"><h1><span>${esc(c.titulo_1)}</span><b>${esc(c.titulo_2)}</b></h1>
      <div class="capa-logos"><img class="capa-ia" src="${logo}" alt="Consultora Isadora Andrade"><span class="mais">+</span>
        ${c.logo_cliente ? `<img class="capa-cli" src="${esc(c.logo_cliente)}" alt="${esc(c.cliente)}">` : `<span class="capa-nome">${esc(c.cliente || "Cliente")}</span>`}</div>
      <div class="capa-ass">${esc(c.assinatura)}</div><div class="capa-b1"></div><div class="capa-b2"></div></section>`);
    pag("sobre", `<section class="s sobre ${c.modelo === "rt" ? "sobre-rt" : ""}">${selo}<div class="curva"></div><div class="foto" style="background-image:url('${u("img/proposta/isadora.jpg")}')" role="img" aria-label="Isadora Andrade"></div>
      <h2>${esc(c.sobre_titulo)}</h2><div class="sobre-txt" data-ajusta>${lista(c.sobre)}${c.trajetoria.length ? `<p>${esc(c.trajetoria_titulo)}</p>${lista(c.trajetoria)}` : ""}</div></section>`);
    pag("clientes", `<section class="s nomes">${selo}<h2>Alguns dos nomes que já<br><span class="c">confiaram no meu trabalho</span></h2><img class="nomes-img" src="${u("img/proposta/clientes.jpg")}" alt="Empresas atendidas"></section>`);

    if (c.modelo === "rt") {
      pag("objetivos", `<section class="s">${selo}<h2>${duo(c.objetivos_titulo, 1, true)}</h2>
        <div class="obj">${c.objetivos.filter(Boolean).map((o) => `<div class="cx">${esc(o)}</div>`).join("")}${c.objetivos_destaque ? `<div class="azul">${negrito(c.objetivos_destaque)}</div>` : ""}</div>${barra}</section>`);
      pag("formato", `<section class="s">${selo}<h2>${duo(c.formato_titulo, 1, true)}</h2>
        <div class="formato" data-ajusta>${c.formato_intro ? `<p class="intro">${esc(c.formato_intro)}</p>` : ""}
          ${c.formato_blocos.map((b) => `<div class="seta"><svg viewBox="0 0 60 40"><path d="M0 14h34V2l26 18-26 18V26H0z" fill="${AZUL}"/></svg><div><b>${esc(b.titulo)}</b>${b.linhas.map((l) => `<span>${esc(l)}</span>`).join("")}</div></div>`).join("")}
          ${c.formato_destaque ? `<div class="azul leve">${negrito(c.formato_destaque)}</div>` : ""}${c.formato_nota ? `<p class="just nota">${esc(c.formato_nota)}</p>` : ""}</div>${barra}</section>`);
      pag("atividades", `<section class="s">${selo}<h2>${duo(c.atividades_titulo, 1, true)}</h2>
        <div class="ativ" data-ajusta>${c.atividades_intro ? `<p>${esc(c.atividades_intro)}</p>` : ""}${lista(c.atividades)}</div>${barra}</section>`);
      pag("remoto", `<section class="s">${selo}<h2>${duo(c.remoto_titulo, 1, true)}</h2>
        <div class="remoto">${c.remoto_intro ? `<p>${esc(c.remoto_intro)}</p>` : ""}<div class="remoto-cx">${c.remoto_caixas.filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join("")}</div>
          ${c.remoto_nota ? `<p class="just">${esc(c.remoto_nota)}</p>` : ""}</div>${barra}</section>`);
      pag("investimento", `<section class="s">${selo}<h2 class="c">${esc(c.rt_titulo)}</h2>
        <div class="inv inv-rt"><h3>Investimento</h3><div class="inv-caixas">
          ${c.valor_mensal ? `<div class="cx rt-cx"><span>Valor mensal${c.horas_incluidas ? `<br>(${esc(c.horas_incluidas)} horas presenciais)` : ""}:</span><b>${esc(c.valor_mensal)}</b></div>` : ""}
          ${c.hora_adicional ? `<div class="cx rt-cx"><span>Hora técnica<br>adicional:</span><b>${esc(c.hora_adicional)}</b></div>` : ""}</div>
          ${c.investimento_obs ? `<p class="inv-obs">${esc(c.investimento_obs)}</p>` : ""}</div>${barra}</section>`);
    } else {
      const etapas = c.etapas.filter((e) => e.nome || e.inclui.length || e.descricao);
      const pontos = `<div class="trilho"><i style="top:24%"></i><i style="top:50%"></i><i style="top:76%"></i></div>`;
      pag("ajuda", `<section class="s">${selo}<h2>${duo(c.ajuda_titulo)}</h2><div class="ajuda" data-ajusta>${c.ajuda_texto.map((p) => `<p class="just">${esc(p)}</p>`).join("")}
        ${c.ajuda_chamada ? `<p class="chamada">${esc(c.ajuda_chamada)}</p>` : ""}</div>
        <div class="caixas">${c.ajuda_caixas.filter(Boolean).map((x) => `<div class="cx">${esc(x)}</div>`).join("")}</div>${barra}</section>`);
      pag("metodo", `<section class="s">${selo}<h2 class="rec">O Método <span class="c">DECIDIR</span></h2>
        <div class="metodo"><div class="metodo-txt">${lista(c.metodo_texto)}</div>
          <div class="metodo-box"><h3>Estrutura do Método</h3>${c.metodo_itens.map((l) => { const m = String(l).match(/^\s*(\S+)\s*[-–—:]\s*(.+)$/); return m ? `<div><b>${esc(m[1])}</b><span>- ${esc(m[2])}</span></div>` : `<div><span>${esc(l)}</span></div>`; }).join("")}</div></div>${barra}</section>`);
      if (etapas.length > 1) pag("geral", `<section class="s">${selo}<h2>Como o Projeto é Executado</h2>
        <div class="geral"><div class="geral-linha"></div>${etapas.map((e, i) => `<div class="geral-item"><div class="etapa-n">Etapa <b>${i + 1}</b></div><i></i><div class="geral-nome">${esc(e.nome)}</div></div>`).join("")}</div>${barra}</section>`);
      etapas.forEach((e, i) => pag("etapas", `<section class="s">${selo}<h2>Como o Projeto é Executado</h2>
        <div class="etapa"><div class="etapa-n">Etapa <b>${i + 1}</b></div>${pontos}
          <div class="etapa-c" data-ajusta><div class="etapa-t">${esc(e.nome)}</div>${e.descricao ? `<p>${esc(e.descricao)}</p>` : ""}
            ${e.inclui.length ? `<p class="rot">Inclui:</p>${lista(e.inclui)}` : ""}${e.entrega.length ? `<p class="rot">Entrega:</p>${lista(e.entrega)}` : ""}</div></div>${barra}</section>`));
      const pagas = etapas.filter((e) => e.valor);
      if (pagas.length) pag("investimento", `<section class="s">${selo}<h2>${esc(c.investimento_titulo)} - <span class="c">Investimento</span></h2>
        <div class="inv"><div class="inv-caixas n${Math.min(pagas.length, 4)}">${etapas.map((e, i) => e.valor ? `<div class="cx inv-cx"><b>${etapas.length > 1 ? `Etapa ${i + 1}:` : "Investimento:"}</b><span>${esc(e.valor)}</span>${e.nota ? `<small>${esc(e.nota)}</small>` : ""}</div>` : "").join("")}</div>
          ${c.investimento_obs ? `<p class="inv-obs">${esc(c.investimento_obs)}</p>` : ""}</div>${barra}</section>`);
      pag("rotulagem", `<section class="s">${selo}<h2>${duo(c.rotulagem.titulo, Math.max(1, String(c.rotulagem.titulo).trim().split(/\s+/).length - 1))}</h2>
        <div class="rotul"><div class="rotul-txt" data-ajusta>${lista(c.rotulagem.itens)}</div>
          ${c.rotulagem.valor ? `<div class="cx inv-cx"><b>Investimento:</b><span>${esc(c.rotulagem.valor)}</span>${c.rotulagem.unidade ? `<small>${esc(c.rotulagem.unidade)}</small>` : ""}</div>` : ""}</div>${barra}</section>`);
    }

    pag("fechamento", `<section class="s fecho"><span class="selo-b"><img src="${logo}" alt=""></span><div class="moldura"><div class="f1">${esc(c.fechamento_1)}</div><div class="f2">${esc(c.fechamento_2)}</div>
      ${c.validade ? `<div class="valid">Proposta válida até ${fmtData(c.validade)}</div>` : ""}</div></section>`);
    pag("contato", `<section class="s contato"><div class="contato-topo"></div><div class="contato-txt"><span>CONSULTORIA</span><b>ISADORA ANDRADE</b>
      ${c.contato.whatsapp ? `<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8a9.2 9.2 0 0 0-7.900 13.900L2.800 21.200l4.700-1.200A9.200 9.200 0 1 0 12 2.800z"/><path d="M8.300 7.600c.6-.6 1.300-.5 1.600.2l.6 1.400c.2.500 0 .9-.3 1.300l-.4.500c.8 1.400 1.900 2.500 3.300 3.200l.6-.5c.4-.3.8-.4 1.300-.2l1.400.7c.6.300.7 1 .2 1.600-.9 1-2.200 1.300-3.500.8-3-1.100-5.200-3.300-6.200-6.100-.4-1.100 0-2.200.8-2.900z" fill="currentColor" stroke="none"/></svg>${esc(c.contato.whatsapp)}</p>` : ""}
      ${c.contato.email ? `<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M3 6l9 7 9-7"/></svg>${esc(c.contato.email)}</p>` : ""}
      ${c.contato.instagram ? `<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/></svg>${esc(c.contato.instagram)}</p>` : ""}</div>
      <img class="contato-logo" src="${logo}" alt="Consultora Isadora Andrade"></section>`);
    return s;
  }

  const CSS = `
  @page { size: 338.67mm 190.5mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; background: #ECE9E6; font-family: Poppins, Arial, sans-serif; color: #111; }
  .barra-acoes { position: sticky; top: 0; z-index: 9; display: flex; gap: 10px; justify-content: center; align-items: center; padding: 12px; background: #fff; border-bottom: 1px solid #ddd6d0; font: 13px Arial; }
  .barra-acoes button { font: 600 14px Arial; padding: 10px 18px; border-radius: 8px; border: 0; cursor: pointer; background: ${COR}; color: #fff; }
  .barra-acoes .sec { background: #ECE9E6; color: #333; }
  .s { width: 1280px; height: 720px; margin: 14px auto; position: relative; overflow: hidden; background: #fff; padding: 76px 110px 40px; break-after: page; page-break-after: always; box-shadow: 0 4px 20px rgba(0,0,0,.12); font-weight: 300; font-size: 23px; line-height: 1.5; }
  .s:last-child { break-after: auto; page-break-after: auto; }
  .c { color: ${COR}; }
  h2 { font: 700 53px/1.15 Arimo, Arial, sans-serif; color: ${ESCURO}; margin: 0 0 44px; }
  h2.rec { margin-left: 50px; }
  ul { margin: 0; padding-left: 1.15em; } li { margin: 0; } p { margin: 0; }
  .selo { position: absolute; left: 0; top: 0; width: 72px; height: 72px; }
  .barra { position: absolute; left: 0; right: 0; bottom: 0; height: 20px; background: ${COR}; }
  .cx { border: 2.5px solid ${COR}; border-radius: 42px; background: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  /* capa */
  .capa { text-align: center; padding: 88px 60px 0; }
  .capa h1 { margin: 0; font-size: 112px; line-height: 1.02; color: #3B3B3B; } .capa h1 span { display: block; font-weight: 500; } .capa h1 b { display: block; font-weight: 600; }
  .capa-logos { position: absolute; left: 0; right: 0; top: 380px; height: 160px; display: grid; grid-template-columns: 1fr 60px 1fr; align-items: center; padding: 0 250px; }
  .capa-ia { height: 158px; justify-self: center; } .mais { font: 400 30px Poppins; color: #333; } .capa-cli { max-height: 120px; max-width: 250px; justify-self: center; object-fit: contain; }
  .capa-nome { font: 600 30px/1.2 Poppins; color: #3B3B3B; justify-self: center; max-width: 280px; }
  .capa-ass { position: absolute; left: 0; right: 0; top: 580px; font: 500 34px Poppins; color: ${COR}; letter-spacing: .01em; }
  .capa-b1 { position: absolute; left: 0; right: 0; bottom: 30px; height: 42px; background: ${COR}; } .capa-b2 { position: absolute; left: 0; right: 0; bottom: 0; height: 20px; background: ${COR}; }
  /* quem é */
  .sobre { padding-right: 420px; padding-left: 34px; }
  .sobre h2 { margin-left: 76px; margin-bottom: 26px; }
  .sobre-txt { height: 560px; overflow: hidden; } .sobre-txt p { margin: 1.4em 0 0; } .sobre-txt ul { padding-left: 1.85em; }
  .curva { position: absolute; right: -640px; top: -260px; width: 820px; height: 1500px; border-radius: 50%; background: ${COR}; }
  .foto { position: absolute; right: 30px; top: 84px; width: 368px; height: 552px; border-radius: 30px; background-size: 580px auto; background-position: 52% 100%; background-repeat: no-repeat; }
  /* nomes */
  .nomes h2 { text-align: center; line-height: 1.38; margin-bottom: 26px; } .nomes-img { display: block; width: 1090px; margin: 0 auto; }
  /* ajuda */
  .ajuda { margin: -6px -38px 0; height: 262px; overflow: hidden; } .just { text-align: justify; } .chamada { margin-top: 1.5em; }
  .caixas { position: absolute; left: 40px; right: 40px; top: 448px; display: flex; gap: 20px; } .caixas .cx { flex: 1; height: 158px; padding: 10px 14px; font-weight: 400; font-size: 24px; line-height: 1.45; }
  /* método */
  .metodo { display: grid; grid-template-columns: 540px 1fr; gap: 50px; margin: 0 -50px 0 -14px; align-items: start; }
  .metodo-txt { padding-top: 46px; font-size: 24px; } .metodo-txt li + li { margin-top: 1.5em; }
  .metodo-box { border: 2.5px solid ${COR}; border-radius: 42px; padding: 20px 6px 44px 16px; margin-top: -4px; font-size: 25.5px; font-weight: 400; }
  .metodo-box h3 { margin: 0 0 14px; text-align: center; font: 700 30px Poppins; color: ${COR}; }
  .metodo-box div { display: grid; grid-template-columns: 34px 1fr; line-height: 1.37; } .metodo-box b { color: ${COR}; font-weight: 700; font-size: 23px; text-align: center; }
  /* etapas */
  .etapa-n { font: 300 44px Poppins; color: ${COR}; white-space: nowrap; } .etapa-n b { font-weight: 600; }
  .geral { position: absolute; left: 34px; right: 60px; top: 152px; bottom: 48px; display: flex; flex-direction: column; justify-content: space-around; }
  .geral-linha, .trilho::before { content: ""; position: absolute; left: 210px; top: 0; bottom: 0; width: 2.5px; background: #111; }
  .geral-item { display: grid; grid-template-columns: 196px 32px 1fr; align-items: center; gap: 0; position: relative; }
  .geral-item i, .trilho i { width: 33px; height: 33px; border-radius: 50%; background: ${COR}; }
  .geral-nome { padding-left: 32px; font-size: 26px; text-decoration: underline; text-underline-offset: 5px; }
  .etapa { position: absolute; left: 34px; right: 14px; top: 152px; bottom: 20px; display: grid; grid-template-columns: 196px 32px 1fr; }
  .etapa > .etapa-n { padding-top: 62px; }
  .trilho { position: relative; margin-bottom: 28px; } .trilho::before { left: 15px; } .trilho i { position: absolute; left: 0; margin-top: -16px; }
  .etapa-c { padding: 28px 0 0 32px; height: 548px; overflow: hidden; font-size: 24px; line-height: 1.44; }
  .etapa-t { text-decoration: underline; text-underline-offset: 5px; font-weight: 400; } .etapa-c .rot { margin-top: 1.44em; } .etapa-c ul { padding-left: 1.75em; }
  /* investimento */
  .inv { position: absolute; left: 188px; right: 188px; top: 167px; bottom: 52px; border: 5px solid ${COR}; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 18px; padding: 0 26px; }
  .inv::before { content: ""; position: absolute; left: -8px; top: 33%; height: 37%; width: 11px; background: #fff; }
  .inv-caixas { display: flex; gap: 18px; align-items: flex-start; justify-content: center; width: 100%; }
  .inv-cx { padding: 26px 12px 28px; min-height: 158px; width: 270px; line-height: 1.3; } .inv-cx b { font: 700 36px Poppins; color: ${COR}; } .inv-cx span { font: 400 36px Poppins; white-space: nowrap; } .inv-cx small { font: 400 25px/1.45 Poppins; }
  .inv-caixas.n4 .inv-cx { width: 205px; } .inv-caixas.n4 .inv-cx b, .inv-caixas.n4 .inv-cx span { font-size: 27px; } .inv-caixas.n4 .inv-cx small { font-size: 19px; }
  .inv-obs { font-size: 20px; text-align: center; font-weight: 400; }
  /* rotulagem */
  .rotul { display: grid; grid-template-columns: 650px 1fr; gap: 54px; align-items: center; margin-top: 26px; }
  .rotul-txt { font-size: 24px; max-height: 420px; overflow: hidden; } .rotul-txt li + li { margin-top: 1.5em; } .rotul .inv-cx { width: 378px; min-height: 190px; justify-self: end; margin-right: 0; } .rotul .inv-cx b { font-size: 40px; }
  /* fechamento */
  .fecho { background: ${COR}; }
  .selo-b { position: absolute; left: 6px; top: 6px; width: 62px; height: 62px; border-radius: 50%; background: #fff; display: grid; place-items: center; } .selo-b img { width: 60px; }
  .moldura { position: absolute; left: 318px; top: 203px; width: 644px; height: 356px; border: 4.5px solid #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; white-space: nowrap; }
  .moldura::before { content: ""; position: absolute; left: -8px; top: 34%; height: 36%; width: 12px; background: ${COR}; }
  .f1 { font: 700 49px Arimo, Arial; color: #fff; margin-top: 30px; } .f2 { font: 700 60px/1 Arimo, Arial; color: ${ESCURO}; }
  .valid { position: absolute; left: 0; right: 0; bottom: 8px; text-align: center; font: 700 17px Arimo, Arial; color: #fff; }
  /* contato */
  .contato-topo { position: absolute; left: 0; right: 0; top: 0; height: 62px; background: ${COR}; }
  .contato-txt { position: absolute; left: 146px; top: 230px; } .contato-txt span { display: block; font: 300 49px Poppins; letter-spacing: .01em; } .contato-txt b { display: block; font: 600 52px/1.5 Poppins; margin-bottom: 40px; }
  .contato-txt p { display: flex; align-items: center; gap: 10px; font-size: 18.5px; font-weight: 300; margin-bottom: 22px; } .contato-txt svg { width: 40px; height: 40px; }
  .contato-logo { position: absolute; right: 150px; top: 290px; width: 240px; }
  @media print { html, body { background: #fff; } .barra-acoes { display: none; } .s { margin: 0; box-shadow: none; } }
  /* modelo de responsabilidade técnica */
  .capa-longa { padding-left: 20px; padding-right: 20px; } .capa-longa h1 { font-size: 80px; line-height: 1.14; padding-top: 74px; white-space: nowrap; } .capa-longa .capa-logos { top: 384px; }
  .sobre-rt .sobre-txt { font-size: 27px; line-height: 2; padding-top: 70px; } .sobre-rt .sobre-txt p { margin-top: 1em; }
  .azul { background: ${AZUL}; color: #fff; font: 700 25px/1.45 Poppins, Arial; text-align: center; padding: 10px 40px; } .azul.leve { font-weight: 300; } .azul.leve b { font-weight: 700; }
  .obj { width: 740px; margin: -26px auto 0; display: flex; flex-direction: column; gap: 11px; } .obj .cx { height: 66px; font-weight: 400; font-size: 26px; padding: 0 8px; white-space: nowrap; } .obj .azul { margin-top: 10px; }
  .formato { margin: -30px -30px 0 -50px; height: 510px; overflow: hidden; font-size: 25px; } .formato .intro { font-weight: 400; font-size: 27px; margin: 0 0 30px 38px; }
  .seta { display: grid; grid-template-columns: 91px 1fr; margin: 0 0 24px; } .seta svg { width: 60px; height: 40px; margin-top: 2px; } .seta b { display: block; font-weight: 400; } .seta span { display: block; }
  .formato .azul { width: 700px; margin: 34px 0 26px 230px; } .formato .nota { margin: 0 60px 0 91px; }
  .ativ { margin: -6px -40px 0 -38px; height: 500px; overflow: hidden; font-size: 26px; } .ativ ul { margin-top: 46px; padding-left: 1.7em; } .ativ li + li { margin-top: 1.1em; }
  .remoto { margin: -8px 130px 0 -42px; font-size: 26px; } .remoto-cx { width: 672px; margin: 38px 0 38px 236px; display: flex; flex-direction: column; gap: 26px; }
  .remoto-cx div { border: 2.5px solid ${COR}; border-radius: 9px; text-align: center; font-weight: 400; font-size: 24px; line-height: 40px; white-space: nowrap; } .remoto .just { line-height: 1.8; }
  .inv-rt { left: 210px; right: 210px; top: 184px; bottom: 60px; justify-content: flex-start; padding-top: 34px; gap: 60px; } .inv-rt h3 { margin: 0; font: 700 40px Poppins; color: ${COR}; }
  .inv-rt .inv-caixas { gap: 56px; } .rt-cx { width: 348px; height: 168px; line-height: 1.35; } .rt-cx span { font: 400 28px/1.35 Poppins; } .rt-cx b { font: 700 40px Poppins; margin-top: 14px; }
  .inv-rt::before { top: 34%; height: 36%; }`;

  // encolhe o texto dos blocos marcados até caber no slide (propostas com muito conteúdo)
  const AJUSTE = `document.fonts.ready.then(function () { document.querySelectorAll("[data-ajusta]").forEach(function (el) {
    var t = parseFloat(getComputedStyle(el).fontSize), n = 0;
    while (el.scrollHeight > el.clientHeight + 1 && t > 13 && n++ < 60) { t -= .5; el.style.fontSize = t + "px"; }
  }); document.body.dataset.pronto = "1"; });`;

  function documentoHTML(conteudo, { nomeArquivo = "Proposta Comercial", base = location.href, barraAcoes = true } = {}) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(nomeArquivo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Arimo:wght@700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
${barraAcoes ? `<div class="barra-acoes"><button onclick="print()">⤓ Baixar PDF</button><span>Escolha <b>Salvar como PDF</b> e ative <b>Gráficos de plano de fundo</b>.</span><button class="sec" onclick="close()">Fechar</button></div>` : ""}
${slidesHTML(conteudo, base).join("\n")}
<script>${AJUSTE}<\/script></body></html>`;
  }

  function abrirProposta(conteudo, opcoes = {}) {
    const w = window.open("", "_blank");
    if (!w) return toast("Libere as janelas pop-up deste site para gerar a proposta.", true);
    w.document.write(documentoHTML(conteudo, opcoes));
    w.document.close();
  }

  window.SIS.propostas = { MODELOS, nomeModelo, MODELO_PADRAO, normalizar, editorHTML, lerEditor, lerLogo, abrirProposta, documentoHTML };
})();
