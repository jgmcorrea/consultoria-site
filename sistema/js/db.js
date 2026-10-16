// Camada de dados.
// Com o config.js preenchido: Supabase de verdade.
// Com o config.js vazio: modo demonstração, com um "Supabase de mentira" em memória
// (mesma interface), para testar as telas sem salvar nada.
window.DB = (() => {
  const cfg = window.CONFIG || {};
  const demo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
  const T = {
    clientes: "cons_clientes", cards: "cons_cards", itens: "cons_itens", horas: "cons_horas",
    prospects: "cons_prospects", labs: "cons_laboratorios", faturas: "cons_faturas", unidades: "cons_unidades", servicos: "cons_servicos",
    lancamentos: "emp_lancamentos", // Financeiro da Empresa (as notas dos clientes viram entradas aqui)
  };
  const OPCIONAIS = ["lancamentos", "servicos"]; // se a tabela não existir ou não tiver acesso, o resto do sistema abre mesmo assim

  const novoId = () => (crypto.randomUUID ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  function minutos(h) {
    const [a, b] = [h.inicio, h.fim].map((t) => { const [hh, mm] = String(t).split(":").map(Number); return hh * 60 + mm; });
    return b - a;
  }

  // ------------------------------------------------------------------
  // Supabase de mentira (só no modo demonstração)
  // ------------------------------------------------------------------
  function criarFake(base) {
    const tabs = JSON.parse(JSON.stringify(base));
    const tab = (t) => (tabs[t] ||= []);
    const derivar = (t, r) => { if (t === "cons_horas" && r.inicio && r.fim) r.minutos = minutos(r); return r; };
    const copia = (x) => JSON.parse(JSON.stringify(x));

    class Q {
      constructor(t) { this.t = t; this.op = "select"; this.f = []; this.ord = null; this.rg = null; this.ret = false; this.um = false; }
      select() { if (this.op !== "select") this.ret = true; return this; }
      insert(v) { this.op = "insert"; this.v = v; return this; }
      update(v) { this.op = "update"; this.v = v; return this; }
      upsert(v, o = {}) { this.op = "upsert"; this.v = v; this.chave = o.onConflict || "id"; return this; }
      delete() { this.op = "delete"; return this; }
      eq(c, v) { this.f.push((r) => String(r[c]) === String(v)); return this; }
      neq(c, v) { this.f.push((r) => String(r[c]) !== String(v)); return this; }
      gte(c, v) { this.f.push((r) => r[c] >= v); return this; }
      lte(c, v) { this.f.push((r) => r[c] <= v); return this; }
      in(c, vs) { this.f.push((r) => vs.map(String).includes(String(r[c]))); return this; }
      order(c, o = {}) { this.ord = [c, o.ascending !== false]; return this; }
      range(a, b) { this.rg = [a, b]; return this; }
      single() { this.um = true; return this; }
      then(ok, erro) { return Promise.resolve().then(() => this.exec()).then(ok, erro); }
      exec() {
        const L = tab(this.t), passa = (r) => this.f.every((fn) => fn(r));
        let out = [];
        if (this.op === "select") {
          out = L.filter(passa);
          if (this.ord) { const [c, asc] = this.ord; out.sort((a, b) => (a[c] ?? "") < (b[c] ?? "") ? (asc ? -1 : 1) : (a[c] ?? "") > (b[c] ?? "") ? (asc ? 1 : -1) : 0); }
          if (this.rg) out = out.slice(this.rg[0], this.rg[1] + 1);
        } else if (this.op === "insert") {
          const linhas = (Array.isArray(this.v) ? this.v : [this.v]).map((v) => derivar(this.t, { id: novoId(), criado_em: new Date().toISOString(), ...copia(v) }));
          L.push(...linhas); out = linhas;
        } else if (this.op === "update") {
          L.filter(passa).forEach((r) => { Object.assign(r, copia(this.v)); derivar(this.t, r); out.push(r); });
        } else if (this.op === "upsert") {
          for (const v of Array.isArray(this.v) ? this.v : [this.v]) {
            const r = L.find((x) => String(x[this.chave]) === String(v[this.chave]));
            if (r) { Object.assign(r, copia(v)); out.push(r); } else { const n = derivar(this.t, { id: novoId(), ...copia(v) }); L.push(n); out.push(n); }
          }
        } else if (this.op === "delete") {
          out = L.filter(passa);
          tabs[this.t] = L.filter((r) => !passa(r));
          cascata(this.t, out.map((r) => r.id));
        }
        const data = copia(out);
        return { data: this.um ? data[0] || null : data, error: null };
      }
    }
    // imita o "on delete cascade" do banco
    function cascata(t, ids) {
      if (!ids.length) return;
      const s = new Set(ids.map(String));
      const apaga = (tt, col) => { const fora = tab(tt).filter((r) => s.has(String(r[col]))); tabs[tt] = tab(tt).filter((r) => !s.has(String(r[col]))); cascata(tt, fora.map((r) => r.id)); };
      if (t === "cons_clientes") { apaga("cons_cards", "cliente_id"); apaga("cons_horas", "cliente_id"); apaga("cons_servicos", "cliente_id"); }
      if (t === "cons_cards") { apaga("cons_itens", "card_id"); tab("cons_horas").forEach((h) => { if (s.has(String(h.card_id))) h.card_id = null; }); }
      if (t === "cons_itens") apaga("cons_itens", "parent_id");
    }
    const sessao = { user: { id: "demo", email: "demonstração" } };
    return {
      from: (t) => new Q(t),
      rpc: async () => ({ data: true, error: null }),
      auth: {
        getSession: async () => ({ data: { session: sessao } }),
        signInWithPassword: async () => ({ data: sessao, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    };
  }

  let sb;
  if (demo) {
    const d = window.DEMO_DADOS || {};
    const base = {
      cons_clientes: d.clientes || [], cons_cards: d.cards || [], cons_itens: d.itens || [], cons_horas: d.horas || [],
      cons_prospects: d.prospects || [], cons_laboratorios: d.labs || [], cons_faturas: d.faturas || [], cons_unidades: d.unidades || [], cons_servicos: d.servicos || [],
      ...(d.financeiro || {}),
    };
    base.cons_horas.forEach((h) => (h.minutos = minutos(h)));
    sb = criarFake(base);
  } else {
    sb = window.supabase.createClient(String(cfg.SUPABASE_URL).trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, ""), String(cfg.SUPABASE_ANON_KEY).trim());
  }

  async function pegarTudo(tabela) {
    const todos = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from(tabela).select("*").range(de, de + 999);
      if (error) throw error;
      todos.push(...data);
      if (data.length < 1000) break;
    }
    return todos;
  }

  async function carregarTudo() {
    const nomes = Object.keys(T);
    const res = await Promise.all(nomes.map((n) => pegarTudo(T[n]).catch((e) => { if (OPCIONAIS.includes(n)) { console.warn(n, e); return []; } throw e; })));
    return Object.fromEntries(nomes.map((n, i) => [n, res[i]]));
  }

  const recarregar = (nome) => pegarTudo(T[nome]);

  async function salvar(tabela, obj) {
    const dados = { ...obj };
    delete dados.minutos; delete dados.criado_em; delete dados.atualizado_em;
    const res = dados.id
      ? await sb.from(T[tabela]).update(dados).eq("id", dados.id).select().single()
      : await sb.from(T[tabela]).insert(dados).select().single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function excluir(tabela, id) {
    const { error } = await sb.from(T[tabela]).delete().eq("id", id);
    if (error) throw error;
  }

  async function sessao() { const { data } = await sb.auth.getSession(); return data.session; }
  async function entrar(email, senha) { const { error } = await sb.auth.signInWithPassword({ email, password: senha }); if (error) throw error; }
  async function sair() { await sb.auth.signOut(); }
  async function temAcesso() {
    const { data, error } = await sb.rpc("cons_e_membro");
    if (error) throw error;
    return data === true;
  }

  return { demo, sb, carregarTudo, recarregar, salvar, excluir, sessao, entrar, sair, temAcesso, minutos, novoId };
})();
