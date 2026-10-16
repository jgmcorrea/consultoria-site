// Sistema da Consultoria Isadora Andrade — núcleo: login, menu, clientes (tarefas, dados, horas).
// Prospecção, Laboratórios, Financeiro e Extrato ficam em arquivos próprios e usam window.SIS.
(() => {
  const $app = document.getElementById("app");
  const $modal = document.getElementById("modal-raiz");
  const $toast = document.getElementById("toast");

  const SECOES = [
    { id: "a_fazer", nome: "A fazer" },
    { id: "feito", nome: "Feito" },
  ];
  const PRIORIDADES = { urgente: "Urgente", alta: "Alta", normal: "Normal", baixa: "Baixa" };

  const S = {
    dados: { clientes: [], cards: [], itens: [], horas: [], prospects: [], labs: [], faturas: [], unidades: [], servicos: [], lancamentos: [] },
    finMes: null,
    mostrarCumpridas: true,
    busca: "",
    recolhidas: {},
    mesHoras: "todos",
    editandoHora: null,
  };

  // ---------- utilidades ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const agoraHora = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const fmtData = (iso) => iso ? iso.split("-").reverse().join("/") : "";
  const fmtDataCurta = (iso) => { if (!iso) return ""; const [a, m, d] = iso.split("-"); return `${d}/${m}` + (a !== hoje().slice(0, 4) ? `/${a.slice(2)}` : ""); };
  const diasAte = (iso) => Math.round((new Date(iso + "T12:00") - new Date(hoje() + "T12:00")) / 86400000);
  const fmtDur = (min) => { min = Math.max(0, Math.round(min || 0)); const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`) : `${m}min`; };
  const fmtDec = (min) => ((min || 0) / 60).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " h";
  const nomeMes = (ym) => { const [a, m] = ym.split("-"); const n = new Date(+a, +m - 1, 1).toLocaleDateString("pt-BR", { month: "long" }); return n[0].toUpperCase() + n.slice(1) + " de " + a; };
  const hora5 = (t) => String(t || "").slice(0, 5);
  const minutosDe = (h) => (h.minutos ?? DB.minutos(h));

  function toast(msg, erro = false) {
    $toast.textContent = msg;
    $toast.className = "mostrar" + (erro ? " erro" : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => ($toast.className = ""), 3200);
  }
  function falha(e) {
    console.error(e);
    const msg = e.message || String(e);
    if (/cons_servicos/.test(msg)) return toast("Falta preparar o banco para serviços prestados: rode o arquivo 04_servicos.sql no Supabase.", true);
    if (/hora_chegada|hora_saida|carregamento|informacoes|despesa_|valor_sem_carga|horas_min_sem_carga|deslocamento_descricao/.test(msg)) return toast("Falta preparar o banco para as visitas de container: rode o arquivo 06_visitas_containers.sql no Supabase.", true);
    if (/nota_mesmo_mes/.test(msg)) return toast("Falta preparar o banco: rode o arquivo 07_nota_mesmo_mes.sql no Supabase.", true);
    if (/valor_hora_fds/.test(msg)) return toast("Falta preparar o banco: rode o arquivo 05_valor_fim_de_semana.sql no Supabase.", true);
    toast("Não foi possível salvar: " + msg, true);
  }

  // ---------- seletores de dados ----------
  const cliente = (id) => S.dados.clientes.find(c => c.id === id);
  const cardsDe = (cid) => S.dados.cards.filter(c => c.cliente_id === cid).sort((a, b) => a.ordem - b.ordem || String(a.criado_em || "").localeCompare(String(b.criado_em || "")));
  const itensDoCard = (cardId) => S.dados.itens.filter(i => i.card_id === cardId).sort((a, b) => a.ordem - b.ordem);
  const itensDoCliente = (cid) => { const ids = new Set(cardsDe(cid).map(c => c.id)); return S.dados.itens.filter(i => ids.has(i.card_id)); };
  // dias mais recentes primeiro; dentro do dia, na ordem dos horários
  const horasDe = (cid) => S.dados.horas.filter(h => h.cliente_id === cid).sort((a, b) => b.data.localeCompare(a.data) || String(a.inicio).localeCompare(String(b.inicio)));

  function estadoPrazo(item) {
    if (!item.prazo || item.cumprido) return "";
    const d = diasAte(item.prazo);
    if (d < 0) return "vencido";
    if (d <= 3) return "proximo";
    return "";
  }
  function resumoCliente(cid) {
    const cardsAbertos = new Set(cardsDe(cid).filter(c => c.secao !== "feito").map(c => c.id));
    const abertos = itensDoCliente(cid).filter(i => !i.cumprido && cardsAbertos.has(i.card_id));
    const vencidos = abertos.filter(i => estadoPrazo(i) === "vencido").length;
    const mes = hoje().slice(0, 7);
    const minMes = horasDe(cid).filter(h => h.data.startsWith(mes)).reduce((s, h) => s + minutosDe(h), 0);
    return { abertos: abertos.length, vencidos, minMes };
  }

  // ---------- roteamento ----------
  function rota() {
    const p = location.hash.replace(/^#\/?/, "").split("/");
    if (p[0] === "c" && p[1]) return { tela: "cliente", id: p[1], aba: p[2] || "tarefas" };
    if (["prospeccao", "laboratorios", "financeiro"].includes(p[0])) return { tela: p[0], sub: p[1] };
    return { tela: "inicio" };
  }
  window.addEventListener("hashchange", render);

  // ---------- telas ----------
  // Guarda a rolagem da tela (página, trilhos dos cards e lista de tarefas de cada card)
  // para redesenhar sem voltar ao início: assim dá para marcar várias tarefas em sequência.
  let ultimaTela = null;
  function capturarRolagem() {
    return {
      y: window.scrollY,
      principal: document.getElementById("principal")?.scrollTop || 0,
      trilhos: [...document.querySelectorAll(".trilho[data-solta]")].map((t) => [t.dataset.solta, t.scrollLeft]),
      itens: [...document.querySelectorAll(".pasta[data-card] .itens")].map((u) => [u.closest(".pasta").dataset.card, u.scrollTop]),
    };
  }
  function restaurarRolagem(r) {
    r.trilhos.forEach(([id, x]) => { const t = document.querySelector(`.trilho[data-solta="${id}"]`); if (t) t.scrollLeft = x; });
    r.itens.forEach(([id, y]) => { const u = document.querySelector(`.pasta[data-card="${id}"] .itens`); if (u) u.scrollTop = y; });
    const p = document.getElementById("principal"); if (p) p.scrollTop = r.principal;
    window.scrollTo(0, r.y);
  }

  function render() {
    const r = rota();
    if (r.tela === "cliente" && !cliente(r.id)) { location.hash = "#/"; return; }
    const modulo = SIS.telas[r.tela];
    const tela = location.hash || "#/";
    const rolagem = tela === ultimaTela ? capturarRolagem() : null;
    ultimaTela = tela;
    // segura a altura durante a troca para a página não "encolher" e pular para o topo
    if (rolagem) $app.style.minHeight = $app.offsetHeight + "px";
    $app.innerHTML = `
      <div class="layout">
        ${barraLateral(r)}
        <main class="principal" id="principal">${r.tela === "cliente" ? telaCliente(r) : modulo ? "" : telaInicio()}</main>
      </div>`;
    if (modulo) modulo(document.getElementById("principal"), r);
    if (r.tela === "cliente" && r.aba === "horas") atualizarDuracao();
    if (rolagem) { restaurarRolagem(rolagem); $app.style.minHeight = ""; }
    else window.scrollTo(0, 0);
  }

  function barraLateral(r) {
    const lista = [...S.dados.clientes].sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome));
    return `
      <aside class="lateral">
        <a class="marca" href="#/">
          <span class="marca-nome">Isadora Andrade</span>
          <span class="marca-sub">Consultoria · sistema interno</span>
        </a>
        <nav class="nav-clientes" aria-label="Clientes">
          <a href="#/" class="nav-link ${r.tela === "inicio" ? "ativo" : ""}">Visão geral</a>
          <a href="#/prospeccao" class="nav-link ${r.tela === "prospeccao" ? "ativo" : ""}"><span>Prospecção</span>${(() => { const n = S.dados.prospects.filter((p) => !["fechado", "perdido"].includes(p.etapa)).length; return n ? `<span class="nav-num">${n}</span>` : ""; })()}</a>
          <a href="#/laboratorios" class="nav-link ${r.tela === "laboratorios" ? "ativo" : ""}">Laboratórios</a>
          <a href="#/financeiro" class="nav-link ${r.tela === "financeiro" ? "ativo" : ""}">Financeiro</a>
          <p class="nav-titulo">Clientes</p>
          ${lista.map(c => { const n = resumoCliente(c.id); return `
            <a href="#/c/${c.id}" class="nav-link ${r.id === c.id ? "ativo" : ""} ${c.ativo === false ? "inativo" : ""}">
              <span>${esc(c.nome)}</span>${n.abertos ? `<span class="nav-num ${n.vencidos ? "alerta" : ""}" title="${n.abertos} tarefas abertas">${n.abertos}</span>` : ""}
            </a>`; }).join("")}
          <button class="nav-novo" data-acao="novo-cliente">+ Novo cliente</button>
        </nav>
        <div class="lateral-rodape">
          ${DB.demo ? `<p class="aviso-demo">Modo demonstração: nada é salvo.</p>` : `<button class="link-sair" data-acao="sair">Sair</button>`}
        </div>
      </aside>`;
  }

  function telaInicio() {
    const clientes = [...S.dados.clientes].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    const proximos = S.dados.clientes.flatMap(c => {
      const feitos = new Set(cardsDe(c.id).filter(k => k.secao === "feito").map(k => k.id));
      return itensDoCliente(c.id).filter(i => i.prazo && !i.cumprido && !feitos.has(i.card_id)).map(i => ({ i, c }));
    }).sort((a, b) => a.i.prazo.localeCompare(b.i.prazo)).slice(0, 12);
    const mes = hoje().slice(0, 7);
    const minMes = S.dados.horas.filter(h => h.data.startsWith(mes)).reduce((s, h) => s + minutosDe(h), 0);

    return `
      <header class="topo">
        <h1>Visão geral</h1>
        <p class="topo-meta">${nomeMes(mes)} · ${fmtDur(minMes)} registradas no mês</p>
      </header>
      ${(() => { const av = SIS.avisosGerais ? SIS.avisosGerais() : []; return av.length ? `<section class="painel-avisos"><h2>Avisos</h2><ul>${av.map((a) => `<li class="aviso ${a.cor}">${a.html}</li>`).join("")}</ul></section>` : ""; })()}
      <section class="grade-clientes">
        ${clientes.map(c => { const n = resumoCliente(c.id); return `
          <a class="bloco-cliente" href="#/c/${c.id}">
            <h2>${esc(c.nome)}</h2>
            <p class="bloco-resp">${c.responsavel ? esc(c.responsavel) : "Responsável não cadastrado"}</p>
            <dl class="bloco-nums">
              <div><dt>Tarefas abertas</dt><dd>${n.abertos}</dd></div>
              <div class="${n.vencidos ? "alerta" : ""}"><dt>Prazos vencidos</dt><dd>${n.vencidos}</dd></div>
              <div><dt>Horas no mês</dt><dd>${fmtDur(n.minMes)}</dd></div>
              ${SIS.calcMes && SIS.mesmoMes(c) ? `<div class="bloco-valor"><dt>Nota de ${nomeMes(mes).split(" ")[0].toLowerCase()} · serviços do próprio mês</dt><dd>${SIS.moeda(SIS.calcMes(c, mes).valor)}</dd></div>` : ""}
              ${SIS.calcMes && !SIS.mesmoMes(c) ? (() => { const ant = SIS.mesAnterior(mes); return `<div class="bloco-valor"><dt>Nota a emitir · serviços de ${nomeMes(ant).split(" ")[0].toLowerCase()}</dt><dd>${SIS.moeda(SIS.calcMes(c, ant).valor)}</dd></div>
              <div class="bloco-valor sec"><dt>Acumulado de ${nomeMes(mes).split(" ")[0].toLowerCase()} · nota no mês que vem</dt><dd>${SIS.moeda(SIS.calcMes(c, mes).valor)}</dd></div>`; })() : ""}
            </dl>
          </a>`; }).join("")}
        <button class="bloco-novo" data-acao="novo-cliente">+ Novo cliente</button>
      </section>
      <section class="painel-prazos">
        <h2>Próximos prazos</h2>
        ${proximos.length ? `<ul class="lista-prazos">${proximos.map(({ i, c }) => { const est = estadoPrazo(i); return `
          <li class="${est}">
            <span class="lp-data">${fmtData(i.prazo)}</span>
            <span class="lp-tarefa"><button class="link" data-acao="abrir-item" data-id="${i.id}" data-cliente="${c.id}">${esc(i.titulo)}</button></span>
            <span class="lp-cliente">${esc(c.nome)}</span>
          </li>`; }).join("")}</ul>` : `<p class="vazio">Nenhuma tarefa aberta com prazo definido.</p>`}
      </section>`;
  }

  function telaCliente(r) {
    const c = cliente(r.id);
    const abas = [["tarefas", "Tarefas"], ["dados", "Dados do cliente"], ["horas", "Horas trabalhadas"], ["financeiro", "Financeiro"]];
    const avisos = SIS.avisosCliente ? SIS.avisosCliente(c) : [];
    const contato = [c.responsavel, c.telefone || c.whatsapp, c.email].filter(Boolean);
    return `
      <header class="topo">
        <h1>${esc(c.nome)}</h1>
        <p class="topo-meta">${contato.length ? contato.map(esc).join(" · ") : `<button class="link" data-acao="ir-aba" data-aba="dados">Cadastrar dados de contato</button>`}</p>
        ${avisos.length ? `<div class="avisos-cliente">${avisos.map((a) => `<p class="aviso ${a.cor}">${a.html}</p>`).join("")}</div>` : ""}
        <nav class="abas" role="tablist">
          ${abas.map(([id, nome]) => `<a role="tab" aria-selected="${r.aba === id}" class="aba ${r.aba === id ? "ativa" : ""}" href="#/c/${c.id}/${id}">${nome}</a>`).join("")}
        </nav>
      </header>
      ${r.aba === "dados" ? abaDados(c) : r.aba === "horas" ? abaHoras(c) : r.aba === "financeiro" ? SIS.abaFinCliente(c) : abaTarefas(c)}`;
  }

  // ---------- aba tarefas ----------
  function abaTarefas(c) {
    const cards = cardsDe(c.id);
    const busca = S.busca.trim().toLowerCase();
    return `
      <div class="barra-ferramentas">
        <label class="busca"><span class="sr">Buscar tarefa</span>
          <input type="search" placeholder="Buscar tarefa ou card" value="${esc(S.busca)}" data-campo="busca">
        </label>
        <label class="alternar"><input type="checkbox" data-campo="mostrar-cumpridas" ${S.mostrarCumpridas ? "checked" : ""}> Mostrar tarefas cumpridas</label>
      </div>
      ${SECOES.map(sec => {
        let doSec = cards.filter(k => k.secao === sec.id);
        if (busca) doSec = doSec.filter(k => k.titulo.toLowerCase().includes(busca) || itensDoCard(k.id).some(i => i.titulo.toLowerCase().includes(busca)));
        const recolhida = S.recolhidas[c.id + sec.id];
        return `
        <section class="secao secao-${sec.id} ${recolhida ? "recolhida" : ""}" data-secao="${sec.id}">
          <header class="secao-cab">
            <button class="secao-titulo" data-acao="recolher" data-secao="${sec.id}" aria-expanded="${!recolhida}">
              <span class="secao-nome">${sec.nome}</span>
              <span class="secao-conta">${doSec.length} ${doSec.length === 1 ? "card" : "cards"}</span>
            </button>
            <button class="botao-sec" data-acao="novo-card" data-secao="${sec.id}">+ Novo card</button>
          </header>
          ${recolhida ? "" : `
          <div class="trilho" data-solta="${sec.id}">
            ${doSec.map((k, n) => pasta(k, busca, n, doSec.length)).join("") || `<p class="trilho-vazio">Nenhum card aqui. Arraste um card para cá ou crie um novo.</p>`}
          </div>`}
        </section>`;
      }).join("")}`;
  }

  function arvore(itens) {
    const porPai = {};
    itens.forEach(i => (porPai[i.parent_id || "raiz"] ||= []).push(i));
    const ids = new Set(itens.map(i => i.id));
    const out = [];
    const anda = (pai, nivel) => (porPai[pai] || []).forEach(i => { out.push({ i, nivel }); anda(i.id, nivel + 1); });
    anda("raiz", 0);
    itens.filter(i => i.parent_id && !ids.has(i.parent_id)).forEach(i => { if (!out.some(o => o.i.id === i.id)) out.push({ i, nivel: 0 }); });
    return out;
  }

  function pasta(k, busca, pos = 0, total = 1) {
    const itens = itensDoCard(k.id);
    const feitos = itens.filter(i => i.cumprido).length;
    let linhas = arvore(itens);
    if (!S.mostrarCumpridas) linhas = linhas.filter(l => !l.i.cumprido);
    const vencidos = itens.filter(i => estadoPrazo(i) === "vencido").length;
    return `
      <article class="pasta" draggable="true" data-card="${k.id}">
        <header class="pasta-aba">
          <h3>${esc(k.titulo)}</h3>
          <span class="pasta-mover">
            <button class="pasta-seta" data-acao="mover-card" data-id="${k.id}" data-dir="-1" aria-label="Mover card para a esquerda" title="Mover para a esquerda" ${pos === 0 ? "disabled" : ""}>‹</button>
            <button class="pasta-seta" data-acao="mover-card" data-id="${k.id}" data-dir="1" aria-label="Mover card para a direita" title="Mover para a direita" ${pos === total - 1 ? "disabled" : ""}>›</button>
          </span>
          <button class="pasta-menu" data-acao="editar-card" data-id="${k.id}" aria-label="Editar card ${esc(k.titulo)}">Editar</button>
        </header>
        <div class="pasta-info">
          <span class="progresso" title="${feitos} de ${itens.length} cumpridas"><span style="width:${itens.length ? (feitos / itens.length) * 100 : 0}%"></span></span>
          <span>${feitos}/${itens.length}</span>
          ${vencidos ? `<span class="chip vencido">${vencidos} vencida${vencidos > 1 ? "s" : ""}</span>` : ""}
          ${k.prazo ? `<span class="chip">Prazo ${fmtDataCurta(k.prazo)}</span>` : ""}
        </div>
        ${k.descricao ? `<p class="pasta-desc">${esc(k.descricao)}</p>` : ""}
        <ul class="itens">
          ${linhas.map(({ i, nivel }) => linhaItem(i, nivel, busca)).join("") || `<li class="itens-vazio">${itens.length ? "Todas as tarefas cumpridas." : "Sem tarefas ainda."}</li>`}
        </ul>
        <button class="add-item" data-acao="novo-item" data-card="${k.id}">+ Adicionar tarefa</button>
      </article>`;
  }

  function linhaItem(i, nivel, busca) {
    const est = estadoPrazo(i);
    const destaque = busca && i.titulo.toLowerCase().includes(busca);
    return `
      <li class="item ${i.cumprido ? "cumprido" : ""} ${destaque ? "destaque" : ""}" style="--nivel:${Math.min(nivel, 3)}">
        <button class="marcar" data-acao="marcar" data-id="${i.id}" role="checkbox" aria-checked="${i.cumprido}" aria-label="Marcar como cumprida"></button>
        <div class="item-corpo">
          <button class="item-titulo" data-acao="abrir-item" data-id="${i.id}">${esc(i.titulo)}</button>
          <div class="item-datas">
            ${(() => { const n = S.dados.itens.filter(x => x.parent_id === i.id); return n.length ? `<span class="chip sub" title="Subtarefas cumpridas">${n.filter(x => x.cumprido).length}/${n.length} subtarefas</span>` : ""; })()}
            ${i.prioridade === "urgente" || i.prioridade === "alta" ? `<span class="chip pri-${i.prioridade}">${PRIORIDADES[i.prioridade]}</span>` : ""}
            ${i.data ? `<span class="chip" title="Data">${fmtDataCurta(i.data)}</span>` : ""}
            ${i.prazo ? `<span class="chip ${est}" title="Prazo">Prazo ${fmtDataCurta(i.prazo)}</span>` : ""}
            ${i.cumprido && i.data_conclusao ? `<span class="chip ok" title="Data de conclusão">Concluída ${fmtDataCurta(i.data_conclusao)}</span>` : ""}
          </div>
        </div>
        <button class="item-sub" data-acao="nova-subtarefa" data-id="${i.id}" aria-label="Adicionar subtarefa em ${esc(i.titulo.slice(0, 60))}" title="Adicionar subtarefa">+</button>
      </li>`;
  }

  // ---------- aba dados ----------
  const CAMPOS_CLIENTE = [
    ["nome", "Nome do cliente", "text", true],
    ["razao_social", "Razão social", "text"],
    ["cnpj", "CNPJ", "text"],
    ["registro", "Registro (SIF, SIE, SIM…)", "text"],
    ["segmento", "Segmento", "text"],
    ["responsavel", "Pessoa responsável", "text"],
    ["cargo_responsavel", "Cargo do responsável", "text"],
    ["email", "E-mail", "email"],
    ["telefone", "Telefone", "tel"],
    ["whatsapp", "WhatsApp", "tel"],
    ["endereco", "Endereço", "text", false, true],
    ["cidade", "Cidade", "text"],
    ["outros_contatos", "Outros contatos", "textarea", false, true],
    ["observacoes", "Observações", "textarea", false, true],
  ];

  // Contrato e cobrança: [campo, rótulo, tipo, modelos em que aparece (vazio = todos), largo]
  const MODELOS = [["hora", "Por hora trabalhada"], ["pacote", "Pacote mensal de horas + hora excedente"], ["unidade", "Por unidade (ex.: container)"], ["servico", "Por serviço prestado"]];
  const CAMPOS_CONTRATO = [
    ["modelo_cobranca", "Forma de cobrança", "select", "", true],
    ["nota_mesmo_mes", "Nota emitida no mesmo mês dos serviços (e não no mês seguinte)", "checkbox", "", true],
    ["valor_hora", "Valor da hora (R$)", "number", "hora"],
    ["pacote_valor", "Valor do pacote por mês (R$)", "number", "pacote"],
    ["pacote_horas", "Horas incluídas no pacote", "number", "pacote"],
    ["valor_hora_extra", "Valor de cada hora além do pacote (R$)", "number", "pacote"],
    ["valor_hora_fds", "Valor da hora no fim de semana (R$)", "number", "hora,pacote"],
    ["unidade_nome", "Unidade cobrada", "text", "unidade"],
    ["valor_unidade", "Valor por unidade, entra na nota (R$)", "number", "unidade"],
    ["reembolso_unidade", "Deslocamento por visita, fora da nota (R$)", "number", "unidade"],
    ["deslocamento_descricao", "Cálculo do deslocamento (aparece no relatório)", "text", "unidade"],
    ["valor_sem_carga", "Dia sem carregamento, entra na nota (R$)", "number", "unidade"],
    ["inicio_contrato", "Início do contrato", "date", ""],
    ["fim_contrato", "Fim do contrato", "date", ""],
    ["indice_reajuste", "Índice de reajuste", "text", ""],
    ["data_reajuste", "Data do próximo reajuste", "date", ""],
    ["descricao_nf", "Descrição padrão da nota fiscal", "textarea", "", true],
  ];
  const campoDados = (c, [k, rot, tipo, obrig, largo]) => `
          <label class="campo ${largo ? "largo" : ""}">
            <span>${rot}</span>
            ${tipo === "textarea"
              ? `<textarea name="${k}" rows="3">${esc(c[k])}</textarea>`
              : `<input type="${tipo}" name="${k}" value="${esc(c[k])}" ${obrig ? "required" : ""}>`}
          </label>`;
  function campoContrato(c, [k, rot, tipo, so, largo]) {
    const modelo = c.modelo_cobranca || "hora";
    const oculto = so && !so.split(",").includes(modelo) ? "hidden" : "";
    // coluna nova: se o banco ainda não tem (SQL não rodado), o campo aparece bloqueado com o aviso
    const NOVAS = { valor_hora_fds: "05_valor_fim_de_semana.sql", valor_sem_carga: "06_visitas_containers.sql", horas_min_sem_carga: "06_visitas_containers.sql", deslocamento_descricao: "06_visitas_containers.sql", nota_mesmo_mes: "07_nota_mesmo_mes.sql" };
    const semColuna = k in NOVAS && !(k in c);
    const avisoSql = semColuna ? `<small class="dica">Rode o arquivo ${NOVAS[k]} no Supabase para liberar este campo.</small>` : "";
    let input;
    if (tipo === "checkbox") return `<label class="alternar largo"><input type="checkbox" name="${k}" ${c[k] ? "checked" : ""} ${semColuna ? "disabled" : ""}> ${rot}${avisoSql ? ` ${avisoSql}` : ""}</label>`;
    if (k === "modelo_cobranca") input = `<select name="${k}" data-campo="modelo">${MODELOS.map(([v, n]) => `<option value="${v}" ${v === modelo ? "selected" : ""}>${n}</option>`).join("")}</select>`;
    else if (tipo === "textarea") input = `<textarea name="${k}" rows="2" placeholder="Ex.: Consultoria técnica em qualidade de alimentos - competência {competencia}">${esc(c[k])}</textarea><small class="dica">Use {competencia}, {horas} e {quantidade} para o sistema preencher sozinho.</small>`;
    else if (tipo === "number") input = `<input type="number" step="0.01" min="0" inputmode="decimal" name="${k}" value="${esc(c[k] ?? "")}" ${semColuna ? "disabled" : ""}>${avisoSql || (k === "valor_hora_fds" ? `<small class="dica">Sábado e domingo. Em branco, o fim de semana é cobrado como dia normal.</small>` : k === "valor_sem_carga" ? `<small class="dica">Quando ela vai e não há carregamento, independente do tempo.</small>` : "")}`;
    else input = `<input type="${tipo}" name="${k}" value="${esc(c[k] ?? (k === "unidade_nome" ? "container" : ""))}" ${k === "indice_reajuste" ? 'list="indices" placeholder="IPCA, IGP-M, INPC…"' : ""} ${k === "deslocamento_descricao" ? 'placeholder="Ex.: R$ 1,70 x 33,5 km"' : ""} ${semColuna ? "disabled" : ""}>${avisoSql}`;
    return `<label class="campo ${largo ? "largo" : ""}" data-so="${so}" ${oculto}><span>${rot}</span>${input}</label>`;
  }

  function abaDados(c) {
    return `
      <form class="form-dados" data-form="cliente" data-id="${c.id}">
        <h2 class="largo form-titulo">Dados do cliente</h2>
        ${CAMPOS_CLIENTE.map((x) => campoDados(c, x)).join("")}
        <h2 class="largo form-titulo">Contrato e cobrança</h2>
        ${CAMPOS_CONTRATO.map((x) => campoContrato(c, x)).join("")}
        <datalist id="indices"><option>IPCA</option><option>IGP-M</option><option>INPC</option><option>Salário mínimo</option></datalist>
        <label class="alternar largo"><input type="checkbox" name="ativo" ${c.ativo !== false ? "checked" : ""}> Cliente ativo</label>
        <div class="acoes largo">
          <button type="submit" class="botao">Salvar dados</button>
          <button type="button" class="botao-perigo" data-acao="excluir-cliente" data-id="${c.id}">Excluir cliente</button>
        </div>
      </form>`;
  }

  // ---------- aba horas ----------
  // Um "lançamento" de horas = um dia + uma descrição + um ou mais horários.
  // No banco cada horário é uma linha de cons_horas; as linhas do mesmo dia com a mesma descrição e o mesmo card
  // formam um lançamento (é assim que aparecem na lista e no extrato).
  function gruposHoras(lista) {
    const mapa = new Map();
    lista.forEach(h => {
      const ch = `${h.cliente_id}|${h.data}|${(h.descricao || "").trim()}|${h.card_id || ""}`;
      if (!mapa.has(ch)) mapa.set(ch, { chave: ch, data: h.data, descricao: h.descricao, card_id: h.card_id, cliente_id: h.cliente_id, itens: [] });
      mapa.get(ch).itens.push(h);
    });
    const out = [...mapa.values()];
    out.forEach(g => { g.itens.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))); g.minutos = g.itens.reduce((s, h) => s + minutosDe(h), 0); g.id = g.itens[0].id; });
    return out.sort((a, b) => b.data.localeCompare(a.data) || String(a.itens[0].inicio).localeCompare(String(b.itens[0].inicio)));
  }
  const grupoDoRegistro = (id) => { const h = S.dados.horas.find(x => x.id === id); return h ? gruposHoras(S.dados.horas.filter(x => x.cliente_id === h.cliente_id && x.data === h.data)).find(g => g.itens.some(x => x.id === id)) : null; };
  // "O que foi feito": cada linha vira um tópico (marcadores digitados como -, • ou * são aceitos)
  const linhasTopicos = (txt) => String(txt || "").split(/\r?\n/).map(l => l.replace(/^\s*([-•*–]|\d+[.)])\s+/, "").trim()).filter(Boolean);
  const topicos = (txt) => { const ls = linhasTopicos(txt); return ls.length > 1 ? `<ul class="topicos">${ls.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : esc(ls[0] || ""); };
  const intervalosTxt = (g, sep = "<br>") => g.itens.map(h => `${hora5(h.inicio)}–${hora5(h.fim)}`).join(sep);

  function abaHoras(c) {
    const todas = horasDe(c.id);
    const meses = [...new Set(todas.map(h => h.data.slice(0, 7)))].sort().reverse();
    if (S.mesHoras !== "todos" && !meses.includes(S.mesHoras)) S.mesHoras = "todos";
    const lista = S.mesHoras === "todos" ? todas : todas.filter(h => h.data.startsWith(S.mesHoras));
    const total = lista.reduce((s, h) => s + minutosDe(h), 0);
    const totalGeral = todas.reduce((s, h) => s + minutosDe(h), 0);
    const ed = S.editandoHora ? grupoDoRegistro(S.editandoHora) : null;
    if (S.editandoHora && !ed) S.editandoHora = null;
    const cards = cardsDe(c.id);
    const grupos = gruposHoras(lista);
    const porMes = {};
    grupos.forEach(g => (porMes[g.data.slice(0, 7)] ||= []).push(g));

    return `
      <div class="horas">
        <form class="form-hora" data-form="hora" data-cliente="${c.id}">
          <h2>${ed ? "Editar registro" : "Registrar horas"}</h2>
          <label class="campo"><span>Data</span><input type="date" name="data" value="${ed ? ed.data : hoje()}" required></label>
          <div class="bloco-horarios">
            <p class="rotulo-horarios">Horários trabalhados</p>
            <div class="linhas-hora">${(ed ? ed.itens : [null]).map((h, i, arr) => linhaHora(h, i + 1, arr.length > 1)).join("")}</div>
            <button type="button" class="add-horario" data-acao="add-horario">+ Adicionar horário</button>
            <p class="duracao total-dia" id="duracao">Total: —</p>
          </div>
          <label class="campo"><span>O que foi feito</span><textarea name="descricao" rows="4" required placeholder="Um tópico por linha. Ex.:&#10;Revisão do PAC de controle de temperatura&#10;Ofício de resposta ao termo de intimação">${ed ? esc(ed.descricao) : ""}</textarea><small class="dica">Cada linha vira um tópico na lista e no extrato. Aperte Enter para começar o próximo.</small></label>
          <label class="campo"><span>Card relacionado (opcional)</span>
            <select name="card_id"><option value="">Nenhum</option>${cards.map(k => `<option value="${k.id}" ${ed && ed.card_id === k.id ? "selected" : ""}>${esc(k.titulo)}</option>`).join("")}</select>
          </label>
          <div class="acoes">
            <button type="submit" class="botao">${ed ? "Salvar alterações" : "Registrar"}</button>
            ${ed ? `<button type="button" class="botao-sec" data-acao="cancelar-hora">Cancelar</button>` : ""}
          </div>
        </form>

        <section class="lista-horas">
          <div class="totais">
            <div><span>${S.mesHoras === "todos" ? "Total registrado" : nomeMes(S.mesHoras)}</span><strong>${fmtDur(total)}</strong><small>${fmtDec(total)}</small></div>
            ${S.mesHoras !== "todos" ? `<div><span>Total geral</span><strong>${fmtDur(totalGeral)}</strong><small>${fmtDec(totalGeral)}</small></div>` : ""}
            <button type="button" class="botao-sec botao-extrato" data-acao="extrato" data-cliente="${c.id}">Extrato do mês (PDF ou Word)</button>
            <label class="campo filtro-mes"><span>Período</span>
              <select data-campo="mes-horas"><option value="todos">Todos os meses</option>${meses.map(m => `<option value="${m}" ${S.mesHoras === m ? "selected" : ""}>${nomeMes(m)}</option>`).join("")}</select>
            </label>
          </div>
          ${grupos.length ? Object.keys(porMes).sort().reverse().map(m => {
            const sub = porMes[m].reduce((s, g) => s + g.minutos, 0);
            return `
            <h3 class="mes-cab"><span>${nomeMes(m)}</span><span>${fmtDur(sub)} · ${fmtDec(sub)}</span></h3>
            <table class="tabela-horas">
              <thead><tr><th>Data</th><th>Horários</th><th>Duração</th><th>O que foi feito</th><th><span class="sr">Ações</span></th></tr></thead>
              <tbody>${porMes[m].map((g, idx, arr) => { const k = cards.find(x => x.id === g.card_id); const doDia = arr.filter(x => x.data === g.data); const ultimoDoDia = doDia.length > 1 && arr[idx + 1]?.data !== g.data; return `
                <tr>
                  <td>${fmtData(g.data)}${(() => { const d = new Date(g.data + "T12:00").getDay(); return d === 0 || d === 6 ? ` <span class="chip fds">${d === 6 ? "sáb" : "dom"}</span>` : ""; })()}</td>
                  <td class="num">${intervalosTxt(g)}</td>
                  <td class="num">${fmtDur(g.minutos)}</td>
                  <td>${topicos(g.descricao)}${k ? `<small class="card-ref">${esc(k.titulo)}</small>` : ""}</td>
                  <td class="acoes-linha"><button class="link" data-acao="editar-hora" data-id="${g.id}">Editar</button><button class="link perigo" data-acao="excluir-hora" data-id="${g.id}">Excluir</button></td>
                </tr>${ultimoDoDia ? `<tr class="total-dia-linha"><td colspan="2">Total de ${fmtData(g.data)}</td><td class="num">${fmtDur(doDia.reduce((s, x) => s + x.minutos, 0))}</td><td colspan="2"></td></tr>` : ""}`; }).join("")}</tbody>
            </table>`;
          }).join("") : `<p class="vazio">Nenhuma hora registrada${S.mesHoras === "todos" ? "" : " neste mês"}. Use o formulário ao lado para registrar a primeira.</p>`}
        </section>
      </div>`;
  }

  // Uma linha de horário (começou / terminou). O "+ Adicionar horário" cria outra no mesmo dia.
  function linhaHora(h, n, removivel) {
    return `
      <div class="linha-hora">
        <span class="linha-num">${n}</span>
        <label class="campo"><span>Começou</span>
          <span class="com-botao"><input type="time" name="inicio" value="${h ? hora5(h.inicio) : ""}" required><button type="button" class="botao-mini" data-acao="agora" data-alvo="inicio" title="Hora atual">Agora</button></span>
        </label>
        <label class="campo"><span>Terminou</span>
          <span class="com-botao"><input type="time" name="fim" value="${h ? hora5(h.fim) : ""}" required><button type="button" class="botao-mini" data-acao="agora" data-alvo="fim" title="Hora atual">Agora</button></span>
        </label>
        <button type="button" class="remover-horario" data-acao="remover-horario" aria-label="Remover este horário" title="Remover este horário" ${removivel ? "" : "hidden"}>×</button>
        <p class="duracao duracao-linha"></p>
      </div>`;
  }
  const linhasDoForm = (f) => [...f.querySelectorAll(".linha-hora")].map(l => ({
    el: l, inicio: l.querySelector('[name="inicio"]').value, fim: l.querySelector('[name="fim"]').value,
  }));
  const minDoDia = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  function conflitos(lista) {
    const ord = [...lista].sort((a, b) => minDoDia(a.inicio) - minDoDia(b.inicio));
    for (let i = 1; i < ord.length; i++) if (minDoDia(ord[i].inicio) < minDoDia(ord[i - 1].fim)) return [ord[i - 1], ord[i]];
    return null;
  }
  function renumerar(f) {
    const ls = [...f.querySelectorAll(".linha-hora")];
    ls.forEach((l, i) => { l.querySelector(".linha-num").textContent = i + 1; l.querySelector(".remover-horario").hidden = ls.length < 2; });
  }

  function atualizarDuracao() {
    const f = document.querySelector('[data-form="hora"]');
    if (!f) return;
    const linhas = linhasDoForm(f);
    let total = 0, falta = false;
    linhas.forEach(l => {
      const el = l.el.querySelector(".duracao-linha");
      if (!l.inicio || !l.fim) { el.textContent = ""; el.classList.remove("erro"); falta = true; return; }
      const m = DB.minutos(l);
      el.textContent = m > 0 ? (linhas.length > 1 ? fmtDur(m) : "") : "O término precisa ser depois do início.";
      el.classList.toggle("erro", m <= 0);
      if (m > 0) total += m; else falta = true;
    });
    const tot = document.getElementById("duracao");
    tot.textContent = total ? `Total: ${fmtDur(total)} (${fmtDec(total)})${falta && linhas.length > 1 ? " · complete os horários" : ""}` : "Total: —";
    f.classList.toggle("varias", linhas.length > 1);
  }

  // ---------- modais ----------
  function abrirModal(titulo, corpo, aoSalvar, extras = "") {
    $modal.innerHTML = `
      <div class="fundo" data-acao="fechar-modal"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <form data-form="modal">
          <header class="modal-cab"><h2 id="modal-titulo">${titulo}</h2><button type="button" class="fechar" data-acao="fechar-modal" aria-label="Fechar">×</button></header>
          <div class="modal-corpo">${corpo}</div>
          <footer class="modal-rodape">${extras}<span class="espaco"></span>${aoSalvar ? `<button type="button" class="botao-sec" data-acao="fechar-modal">Cancelar</button><button type="submit" class="botao">Salvar</button>` : `<button type="button" class="botao-sec" data-acao="fechar-modal">Fechar</button>`}</footer>
        </form>
      </div>`;
    $modal.classList.add("aberto");
    $modal._salvar = aoSalvar;
    const primeiro = $modal.querySelector("textarea, input:not([type=checkbox]), select");
    if (primeiro) primeiro.focus();
  }
  function fecharModal() { $modal.classList.remove("aberto"); $modal.innerHTML = ""; $modal._salvar = null; }

  function modalItem(item, cardId, paiId = null) {
    const novo = !item;
    item = item || { card_id: cardId, parent_id: paiId, data: hoje(), cumprido: false };
    const pai = item.parent_id ? S.dados.itens.find(i => i.id === item.parent_id) : null;
    const filhos = novo ? [] : S.dados.itens.filter(i => i.parent_id === item.id).sort((a, b) => a.ordem - b.ordem);
    const card = S.dados.cards.find(k => k.id === item.card_id);
    const cardsCli = cardsDe(card.cliente_id);
    const bloqueados = new Set([item.id, ...(novo ? [] : descendentes(item.id).map(i => i.id))]);
    const outros = itensDoCard(item.card_id).filter(i => !bloqueados.has(i.id));
    abrirModal(novo ? (pai ? "Nova subtarefa" : "Nova tarefa") : (pai ? "Subtarefa" : "Tarefa"), `
      ${pai ? `<p class="modal-pai">Subtarefa de <button type="button" class="link" data-acao="abrir-item" data-id="${pai.id}">${esc(pai.titulo.slice(0, 90))}</button></p>` : ""}
      <label class="campo"><span>${pai ? "Subtarefa" : "Tarefa"}</span><textarea name="titulo" rows="3" required>${esc(item.titulo)}</textarea></label>
      <label class="campo"><span>Observações</span><textarea name="descricao" rows="2">${esc(item.descricao)}</textarea></label>
      <div class="grade-3">
        <label class="campo"><span>Data</span><input type="date" name="data" value="${item.data || ""}"></label>
        <label class="campo"><span>Prazo</span><input type="date" name="prazo" value="${item.prazo || ""}"></label>
        <label class="campo"><span>Prioridade</span><select name="prioridade"><option value="">—</option>${Object.entries(PRIORIDADES).map(([k, v]) => `<option value="${k}" ${item.prioridade === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
      <label class="alternar cumprido-toggle"><input type="checkbox" name="cumprido" ${item.cumprido ? "checked" : ""} data-acao="toggle-cumprido"> Cumprido</label>
      <label class="campo conclusao" ${item.cumprido ? "" : "hidden"}><span>Data de conclusão</span><input type="date" name="data_conclusao" value="${item.data_conclusao || ""}"></label>
      ${novo ? "" : `
      <div class="modal-subs">
        <p class="modal-subs-tit">Subtarefas${filhos.length ? ` (${filhos.filter(x => x.cumprido).length}/${filhos.length} cumpridas)` : ""}</p>
        ${filhos.length ? `<ul>${filhos.map(x => `<li class="${x.cumprido ? "cumprido" : ""}"><button type="button" class="link" data-acao="abrir-item" data-id="${x.id}">${esc(x.titulo.slice(0, 90))}</button></li>`).join("")}</ul>` : ""}
        <button type="button" class="botao-sec botao-mini" data-acao="nova-subtarefa" data-id="${item.id}">+ Adicionar subtarefa</button>
      </div>`}
      <details class="mais">
        <summary>Mover ou organizar</summary>
        <div class="grade-2">
          <label class="campo"><span>Card</span><select name="card_id">${cardsCli.map(k => `<option value="${k.id}" ${k.id === item.card_id ? "selected" : ""}>${esc(k.titulo)} (${SECOES.find(s => s.id === k.secao).nome})</option>`).join("")}</select></label>
          <label class="campo"><span>Subtarefa de</span><select name="parent_id"><option value="">Nenhuma (tarefa principal)</option>${outros.map(o => `<option value="${o.id}" ${o.id === item.parent_id ? "selected" : ""}>${esc(o.titulo.slice(0, 70))}</option>`).join("")}</select></label>
        </div>
      </details>`,
      async (f) => {
        const novoCard = f.card_id.value;
        const dados = {
          ...(novo ? {} : { id: item.id }),
          card_id: novoCard,
          parent_id: novoCard !== item.card_id ? null : (f.parent_id.value || null),
          titulo: f.titulo.value.trim(),
          descricao: f.descricao.value.trim(),
          data: f.data.value || null,
          prazo: f.prazo.value || null,
          prioridade: f.prioridade.value || null,
          cumprido: f.cumprido.checked,
          data_conclusao: f.cumprido.checked ? (f.data_conclusao.value || hoje()) : null,
        };
        if (novo) dados.ordem = Math.max(-1, ...itensDoCard(novoCard).map(i => i.ordem ?? 0)) + 1;
        else if (novoCard !== item.card_id) dados.ordem = itensDoCard(novoCard).length;
        const salvo = await DB.salvar("itens", dados);
        guardarLocal("itens", salvo);
        if (novoCard !== item.card_id) {
          // filhos acompanham a tarefa para o novo card
          const filhos = descendentes(item.id);
          for (const fi of filhos) guardarLocal("itens", await DB.salvar("itens", { id: fi.id, card_id: novoCard }));
        }
        toast(novo ? "Tarefa criada." : "Tarefa salva.");
      },
      novo ? "" : `<button type="button" class="botao-perigo" data-acao="excluir-item" data-id="${item.id}">Excluir</button>`);
  }

  function descendentes(id) {
    const out = []; const fila = [id];
    while (fila.length) { const p = fila.shift(); S.dados.itens.filter(i => i.parent_id === p).forEach(i => { out.push(i); fila.push(i.id); }); }
    return out;
  }

  function modalCard(card, clienteId, secao) {
    const novo = !card;
    card = card || { cliente_id: clienteId, secao, titulo: "" };
    abrirModal(novo ? "Novo card" : "Editar card", `
      <label class="campo"><span>Título</span><input type="text" name="titulo" value="${esc(card.titulo)}" required placeholder="Ex.: Processo nº 21000.000000/2026-00"></label>
      <label class="campo"><span>Descrição</span><textarea name="descricao" rows="3">${esc(card.descricao)}</textarea></label>
      <div class="grade-2">
        <label class="campo"><span>Seção</span><select name="secao">${SECOES.map(s => `<option value="${s.id}" ${s.id === card.secao ? "selected" : ""}>${s.nome}</option>`).join("")}</select></label>
        <label class="campo"><span>Prazo do card</span><input type="date" name="prazo" value="${card.prazo || ""}"></label>
      </div>`,
      async (f) => {
        const dados = {
          ...(novo ? { cliente_id: clienteId } : { id: card.id }),
          titulo: f.titulo.value.trim(), descricao: f.descricao.value.trim(),
          secao: f.secao.value, prazo: f.prazo.value || null,
        };
        if (novo || dados.secao !== card.secao) dados.ordem = cardsDe(card.cliente_id).filter(k => k.secao === dados.secao).length;
        guardarLocal("cards", await DB.salvar("cards", dados));
        toast(novo ? "Card criado." : "Card salvo.");
      },
      novo ? "" : `<button type="button" class="botao-perigo" data-acao="excluir-card" data-id="${card.id}">Excluir card</button>`);
  }

  function modalNovoCliente() {
    abrirModal("Novo cliente", `
      <label class="campo"><span>Nome do cliente</span><input type="text" name="nome" required></label>
      <p class="dica">Depois você completa e-mail, telefone, responsável e os demais dados na aba “Dados do cliente”.</p>`,
      async (f) => {
        const salvo = await DB.salvar("clientes", { nome: f.nome.value.trim(), ordem: S.dados.clientes.length, ativo: true });
        guardarLocal("clientes", salvo);
        location.hash = `#/c/${salvo.id}/dados`;
        toast("Cliente criado.");
      });
  }

  function guardarLocal(tabela, obj) {
    const lista = S.dados[tabela];
    const i = lista.findIndex(x => x.id === obj.id);
    if (i >= 0) lista[i] = obj; else lista.push(obj);
  }

  // ---------- eventos ----------
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-acao]");
    if (!el) return;
    const acao = el.dataset.acao;
    const r = rota();
    try {
      switch (acao) {
        case "fechar-modal": fecharModal(); break;
        case "novo-cliente": modalNovoCliente(); break;
        case "ir-aba": location.hash = `#/c/${r.id}/${el.dataset.aba}`; break;
        case "recolher": S.recolhidas[r.id + el.dataset.secao] = !S.recolhidas[r.id + el.dataset.secao]; render(); break;
        case "novo-card": modalCard(null, r.id, el.dataset.secao); break;
        case "editar-card": modalCard(S.dados.cards.find(k => k.id === el.dataset.id)); break;
        case "novo-item": modalItem(null, el.dataset.card); break;
        case "nova-subtarefa": { const p = S.dados.itens.find(i => i.id === el.dataset.id); modalItem(null, p.card_id, p.id); break; }
        case "mover-card": {
          const k = S.dados.cards.find(x => x.id === el.dataset.id);
          const lista = cardsDe(k.cliente_id).filter(x => x.secao === k.secao);
          const de = lista.indexOf(k), para = de + Number(el.dataset.dir);
          if (para < 0 || para >= lista.length) break;
          lista.splice(de, 1); lista.splice(para, 0, k);
          await reordenar(lista, k.secao);
          render();
          document.querySelector(`.pasta[data-card="${k.id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
          break;
        }
        case "abrir-item": modalItem(S.dados.itens.find(i => i.id === el.dataset.id)); break;
        case "toggle-cumprido": {
          const f = el.form; const box = f.querySelector(".conclusao");
          box.hidden = !el.checked;
          if (el.checked && !f.data_conclusao.value) f.data_conclusao.value = hoje();
          break;
        }
        case "marcar": {
          const it = S.dados.itens.find(i => i.id === el.dataset.id);
          const cumprido = !it.cumprido;
          guardarLocal("itens", await DB.salvar("itens", { id: it.id, cumprido, data_conclusao: cumprido ? (it.data_conclusao || hoje()) : null }));
          render();
          if (cumprido) toast(`Cumprida em ${fmtData(hoje())}. Para mudar a data, abra a tarefa.`);
          break;
        }
        case "excluir-item": {
          if (!confirm("Excluir esta tarefa" + (descendentes(el.dataset.id).length ? " e as subtarefas dela" : "") + "?")) return;
          await DB.excluir("itens", el.dataset.id);
          const apagar = new Set([el.dataset.id, ...descendentes(el.dataset.id).map(i => i.id)]);
          S.dados.itens = S.dados.itens.filter(i => !apagar.has(i.id));
          fecharModal(); render(); toast("Tarefa excluída.");
          break;
        }
        case "excluir-card": {
          const n = itensDoCard(el.dataset.id).length;
          if (!confirm(`Excluir este card${n ? ` e as ${n} tarefas dentro dele` : ""}?`)) return;
          await DB.excluir("cards", el.dataset.id);
          S.dados.cards = S.dados.cards.filter(k => k.id !== el.dataset.id);
          S.dados.itens = S.dados.itens.filter(i => i.card_id !== el.dataset.id);
          fecharModal(); render(); toast("Card excluído.");
          break;
        }
        case "excluir-cliente": {
          const c = cliente(el.dataset.id);
          if (!confirm(`Excluir ${c.nome} com todos os cards, tarefas e horas? Isso não pode ser desfeito.`)) return;
          await DB.excluir("clientes", c.id);
          const cards = new Set(cardsDe(c.id).map(k => k.id));
          S.dados.clientes = S.dados.clientes.filter(x => x.id !== c.id);
          S.dados.cards = S.dados.cards.filter(k => k.cliente_id !== c.id);
          S.dados.itens = S.dados.itens.filter(i => !cards.has(i.card_id));
          S.dados.horas = S.dados.horas.filter(h => h.cliente_id !== c.id);
          location.hash = "#/"; toast("Cliente excluído.");
          break;
        }
        case "agora": { el.closest(".linha-hora").querySelector(`[name="${el.dataset.alvo}"]`).value = agoraHora(); atualizarDuracao(); break; }
        case "add-horario": {
          const f = el.closest("form"); const box = f.querySelector(".linhas-hora");
          box.insertAdjacentHTML("beforeend", linhaHora(null, box.children.length + 1, true));
          renumerar(f);
          box.lastElementChild.querySelector('[name="inicio"]').focus();
          atualizarDuracao();
          break;
        }
        case "remover-horario": { const f = el.closest("form"); el.closest(".linha-hora").remove(); renumerar(f); atualizarDuracao(); break; }
        case "editar-hora": S.editandoHora = el.dataset.id; render(); document.querySelector('[data-form="hora"]').scrollIntoView({ behavior: "smooth", block: "start" }); break;
        case "cancelar-hora": S.editandoHora = null; render(); break;
        case "excluir-hora": {
          const g = grupoDoRegistro(el.dataset.id);
          if (!g) break;
          if (!confirm(g.itens.length > 1 ? `Excluir este registro com os ${g.itens.length} horários dele?` : "Excluir este registro de horas?")) return;
          for (const h of g.itens) await DB.excluir("horas", h.id);
          const fora = new Set(g.itens.map(h => h.id));
          S.dados.horas = S.dados.horas.filter(h => !fora.has(h.id));
          if (fora.has(S.editandoHora)) S.editandoHora = null;
          render(); toast("Registro excluído.");
          break;
        }
        case "sair": await DB.sair(); location.reload(); break;
        default: if (SIS.acoes[acao]) await SIS.acoes[acao](el, e);
      }
    } catch (err) { falha(err); }
  });

  document.addEventListener("input", (e) => {
    const c = e.target.dataset.campo;
    if (c === "busca") {
      S.busca = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const novo = document.querySelector('[data-campo="busca"]');
      novo.focus(); novo.setSelectionRange(pos, pos);
    }
    if (e.target.closest('[data-form="hora"]') && (e.target.name === "inicio" || e.target.name === "fim")) atualizarDuracao();
  });

  document.addEventListener("change", (e) => {
    const c = e.target.dataset.campo;
    if (c === "mostrar-cumpridas") { S.mostrarCumpridas = e.target.checked; render(); }
    if (c === "mes-horas") { S.mesHoras = e.target.value; render(); }
    if (c === "modelo") e.target.form.querySelectorAll("[data-so]").forEach((l) => { l.hidden = !!l.dataset.so && !l.dataset.so.split(",").includes(e.target.value); });
  });

  document.addEventListener("submit", async (e) => {
    const f = e.target;
    const tipo = f.dataset.form;
    if (!tipo) return;
    e.preventDefault();
    const btn = f.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      if (tipo === "modal" && $modal._salvar) { await $modal._salvar(f); fecharModal(); render(); }
      if (tipo === "cliente") {
        const dados = { id: f.dataset.id, ativo: f.ativo.checked };
        CAMPOS_CLIENTE.forEach(([k]) => { const v = f[k].value.trim(); dados[k] = v === "" ? null : v; });
        CAMPOS_CONTRATO.forEach(([k, , tipo]) => { if (f[k].disabled) return; if (tipo === "checkbox") { dados[k] = f[k].checked; return; } const v = f[k].value.trim(); dados[k] = v === "" ? null : tipo === "number" ? Number(v.replace(",", ".")) : v; });
        dados.modelo_cobranca = dados.modelo_cobranca || "hora";
        guardarLocal("clientes", await DB.salvar("clientes", dados));
        render(); toast("Dados salvos.");
      }
      if (tipo === "hora") {
        const data = f.data.value, cliente_id = f.dataset.cliente;
        const descricao = f.descricao.value.trim(), card_id = f.card_id.value || null;
        const linhas = linhasDoForm(f).map(({ inicio, fim }) => ({ inicio, fim }));
        const ruim = linhas.findIndex(l => DB.minutos(l) <= 0);
        if (ruim >= 0) { toast(`${linhas.length > 1 ? `Horário ${ruim + 1}: o` : "O"} término precisa ser depois do início.`, true); return; }
        const ed = S.editandoHora ? grupoDoRegistro(S.editandoHora) : null;
        const meus = new Set(ed ? ed.itens.map(h => h.id) : []);
        const doDia = S.dados.horas.filter(h => h.cliente_id === cliente_id && h.data === data && !meus.has(h.id)).map(h => ({ inicio: hora5(h.inicio), fim: hora5(h.fim), jaRegistrado: true }));
        const choque = conflitos([...linhas, ...doDia]);
        if (choque) {
          const txt = (x) => `${x.inicio}–${x.fim}${x.jaRegistrado ? " (já registrado neste dia)" : ""}`;
          toast(`Os horários ${txt(choque[0])} e ${txt(choque[1])} se sobrepõem. Ajuste antes de salvar.`, true); return;
        }
        linhas.sort((a, b) => a.inicio.localeCompare(b.inicio));
        const base = { cliente_id, data, descricao, card_id };
        const antigos = ed ? [...ed.itens] : [];
        for (const l of linhas) {
          const velho = antigos.shift();
          guardarLocal("horas", await DB.salvar("horas", { ...(velho ? { id: velho.id } : {}), ...base, ...l }));
        }
        for (const sobra of antigos) { await DB.excluir("horas", sobra.id); S.dados.horas = S.dados.horas.filter(h => h.id !== sobra.id); }
        const total = linhas.reduce((s, l) => s + DB.minutos(l), 0);
        S.editandoHora = null; render();
        toast(`${ed ? "Registro salvo" : "Horas registradas"}: ${fmtDur(total)}${linhas.length > 1 ? ` em ${linhas.length} horários` : ""}.`);
      }
      if (tipo === "login") {
        await DB.entrar(f.email.value.trim(), f.senha.value);
        iniciar();
      }
    } catch (err) {
      if (tipo === "login") { const p = f.querySelector(".erro-login"); p.textContent = "E-mail ou senha incorretos."; p.hidden = false; }
      else falha(err);
    } finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $modal.classList.contains("aberto")) fecharModal(); });

  // Grava a nova ordem (e a seção) dos cards de uma seção, só nos que mudaram
  async function reordenar(lista, secao) {
    const mudou = lista.map((k, ordem) => ({ k, ordem })).filter(({ k, ordem }) => k.ordem !== ordem || k.secao !== secao);
    mudou.forEach(({ k, ordem }) => { k.ordem = ordem; k.secao = secao; }); // já mostra na tela
    const salvos = await Promise.all(mudou.map(({ k, ordem }) => DB.salvar("cards", { id: k.id, secao, ordem })));
    salvos.forEach(x => guardarLocal("cards", x));
  }

  // Arrastar cards: muda de seção (A fazer, Fazendo, Feito) e de posição dentro da seção
  let arrastando = null;
  const limparMarcas = () => document.querySelectorAll(".alvo,.inserir-antes,.inserir-fim").forEach(x => x.classList.remove("alvo", "inserir-antes", "inserir-fim"));
  function pontoDeInsercao(trilho, x) {
    const cards = [...trilho.querySelectorAll(".pasta[data-card]")].filter(p => p.dataset.card !== arrastando);
    const antes = cards.find(p => { const b = p.getBoundingClientRect(); return x < b.left + b.width / 2; });
    return { antes, cards };
  }
  document.addEventListener("dragstart", (e) => {
    const k = e.target.closest?.("[data-card].pasta");
    if (!k) return;
    arrastando = k.dataset.card; k.classList.add("arrastando");
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", arrastando);
  });
  document.addEventListener("dragend", () => { document.querySelectorAll(".arrastando").forEach(x => x.classList.remove("arrastando")); limparMarcas(); arrastando = null; });
  document.addEventListener("dragover", (e) => {
    const t = e.target.closest("[data-secao].secao");
    if (!t || !arrastando) return;
    e.preventDefault();
    limparMarcas();
    t.classList.add("alvo");
    const trilho = t.querySelector(".trilho");
    if (!trilho) return;
    // rola o trilho sozinho quando o card chega perto da borda
    const b = trilho.getBoundingClientRect();
    if (e.clientX > b.right - 60) trilho.scrollLeft += 18;
    else if (e.clientX < b.left + 60) trilho.scrollLeft -= 18;
    const { antes, cards } = pontoDeInsercao(trilho, e.clientX);
    if (antes) antes.classList.add("inserir-antes");
    else if (cards.length) cards[cards.length - 1].classList.add("inserir-fim");
  });
  document.addEventListener("drop", async (e) => {
    const t = e.target.closest("[data-secao].secao");
    if (!t || !arrastando) return;
    e.preventDefault();
    const card = S.dados.cards.find(k => k.id === arrastando);
    const secao = t.dataset.secao;
    const trilho = t.querySelector(".trilho");
    const lista = cardsDe(card.cliente_id).filter(k => k.secao === secao && k.id !== card.id);
    let pos = lista.length;
    if (trilho) { const { antes } = pontoDeInsercao(trilho, e.clientX); if (antes) pos = lista.findIndex(k => k.id === antes.dataset.card); }
    lista.splice(pos < 0 ? lista.length : pos, 0, card);
    const mudouSecao = card.secao !== secao;
    limparMarcas();
    try {
      await reordenar(lista, secao);
      render();
      if (mudouSecao) toast(`Card movido para ${SECOES.find(s => s.id === secao).nome}.`);
    } catch (err) { falha(err); }
  });

  // ---------- início ----------
  function telaLogin() {
    $app.innerHTML = `
      <div class="login">
        <form class="login-caixa" data-form="login">
          <p class="marca-nome">Isadora Andrade</p>
          <h1>Entrar no sistema</h1>
          <label class="campo"><span>E-mail</span><input type="email" name="email" autocomplete="username" required></label>
          <label class="campo"><span>Senha</span><input type="password" name="senha" autocomplete="current-password" required></label>
          <p class="erro-login" hidden></p>
          <button type="submit" class="botao">Entrar</button>
        </form>
      </div>`;
  }

  async function iniciar() {
    try {
      const s = await DB.sessao();
      if (!s) return telaLogin();
      if (!(await DB.temAcesso())) {
        $app.innerHTML = `<div class="login"><div class="login-caixa"><h1>Sem acesso</h1><p>O e-mail ${esc(s.user.email)} entrou, mas não está liberado neste sistema. Libere-o no arquivo 02_acesso.sql do Supabase.</p><button class="botao" data-acao="sair">Sair</button></div></div>`;
        return;
      }
      $app.innerHTML = `<p class="carregando">Carregando…</p>`;
      S.dados = await DB.carregarTudo();
      // seção "Fazendo" foi retirada: algum card antigo que ainda esteja nela aparece em "A fazer"
      S.dados.cards.forEach(k => { if (!SECOES.some(x => x.id === k.secao)) k.secao = "a_fazer"; });
      render();
    } catch (err) {
      console.error(err);
      const semBanco = /cons_|schema cache|does not exist|Could not find/i.test(err.message || "");
      $app.innerHTML = `<div class="login"><div class="login-caixa"><h1>${semBanco ? "Banco ainda não preparado" : "Não foi possível carregar"}</h1>
        <p>${semBanco ? "O login funcionou, mas as tabelas do sistema ainda não existem no Supabase. Rode os arquivos 01_tabelas.sql e 03_migracao_clickup.sql no SQL Editor e entre de novo." : esc(err.message || err)}</p>
        <button class="botao" onclick="location.reload()">Tentar de novo</button> <button class="botao-sec" data-acao="sair">Sair</button></div></div>`;
    }
  }
  // Formulário genérico (usado por Prospecção e Laboratórios)
  // campo: { n, r: rótulo, t: text|email|tel|url|date|number|textarea|select, o: [[valor, rótulo]], full, req, ph }
  function formCampos(campos, v = {}) {
    return `<div class="grade-form">${campos.map((c) => {
      const val = v[c.n] ?? c.padrao ?? "";
      const req = c.req ? "required" : "";
      let input;
      if (c.t === "textarea") input = `<textarea name="${c.n}" rows="${c.linhas || 3}" ${req} placeholder="${esc(c.ph || "")}">${esc(val)}</textarea>`;
      else if (c.t === "select") input = `<select name="${c.n}" ${req}>${c.vazio !== false ? `<option value="">${esc(c.vazio || "—")}</option>` : ""}${c.o.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(val) === String(ov) ? "selected" : ""}>${esc(ol)}</option>`).join("")}</select>`;
      else input = `<input type="${c.t || "text"}" name="${c.n}" value="${esc(val)}" ${req} ${c.t === "number" ? 'step="0.01" inputmode="decimal"' : ""} placeholder="${esc(c.ph || "")}" ${c.lista ? `list="${c.lista}"` : ""}>`;
      return `<label class="campo ${c.full || c.t === "textarea" ? "largo" : ""}"><span>${esc(c.r)}</span>${input}</label>`;
    }).join("")}</div>`;
  }
  function lerCampos(f, campos) {
    const out = {};
    for (const c of campos) {
      const el = f.elements[c.n];
      if (!el) continue;
      const v = el.value.trim();
      out[c.n] = v === "" ? null : c.t === "number" ? Number(v.replace(",", ".")) : v;
    }
    return out;
  }

  window.SIS = {
    S, telas: {}, acoes: {}, esc, toast, falha, hoje, fmtData, fmtDataCurta, diasAte, fmtDur, fmtDec, nomeMes, hora5, minutosDe,
    abrirModal, fecharModal, guardarLocal, render, formCampos, lerCampos, cliente, cardsDe, horasDe, gruposHoras, linhasTopicos,
  };
  document.addEventListener("DOMContentLoaded", iniciar);
})();
