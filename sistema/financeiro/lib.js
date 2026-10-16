// Utilidades compartilhadas (banco, formatação, modais, formulários)
// Dentro do Sistema da Consultoria: usa a mesma conexão (e o mesmo login) do sistema.
export const sb = window.DB.sb;
export const configurado = true;

// ---------- texto / formatação ----------
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const moeda = (v) => (v === null || v === undefined || v === "" ? "—" : brl.format(Number(v)));
export const pct = (v, casas = 0) => (v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(casas).replace(".", ",")}%`);
export const data = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const nomeMes = (iso, longo = false) => {
  if (!iso) return "—";
  const [a, m] = iso.slice(0, 7).split("-").map(Number);
  return longo ? `${MESES_LONGOS[m - 1]} de ${a}` : `${MESES[m - 1]}/${String(a).slice(2)}`;
};
export const validadeTxt = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
// valor com cor (verde positivo / vermelho negativo)
export const moedaCor = (v) => `<span class="num ${Number(v) < 0 ? "neg" : Number(v) > 0 ? "pos" : ""}">${moeda(v)}</span>`;

// ---------- opções e rótulos ----------
export const CAT_ENTRADA = ["Serviços (nota fiscal)", "Aporte da sócia", "Rendimento de aplicação", "Reembolso", "Outra entrada"];
export const CAT_SAIDA = ["Contador", "Software e assinaturas", "Marketing", "Equipamentos", "Deslocamento e viagens", "Cursos e eventos", "Tarifas bancárias", "Taxas e alvarás", "Certificado digital", "Material de escritório", "Outra saída"];
export const OPC = {
  tipo: [["entrada", "Entrada", "verde"], ["saida", "Saída", "vermelho"]],
  status_entrada: [["pago", "Recebido", "verde"], ["pendente", "A receber", "amarelo"]],
  status_saida: [["pago", "Pago", "verde"], ["pendente", "A pagar", "amarelo"]],
  repete: [["nao", "Não repete", ""], ["mensal", "Todo mês", ""], ["anual", "Todo ano", ""]],
  anexo: [["III", "Anexo III", "verde"], ["V", "Anexo V", "vermelho"]],
};
export const rotulo = (grupo, v) => (OPC[grupo].find((o) => o[0] === v) || [v, v ?? "—"])[1];
export const badge = (grupo, v) => {
  const o = OPC[grupo].find((x) => x[0] === v);
  return `<span class="badge ${o ? o[2] : ""}">${esc(o ? o[1] : v ?? "—")}</span>`;
};
export const badgeTxt = (txt, cor = "") => `<span class="badge ${cor}">${esc(txt)}</span>`;

// ---------- banco ----------
export async function q(promessa) {
  const { data, error } = await promessa;
  if (error) {
    toast(traduzErro(error.message), "erro");
    throw error;
  }
  return data;
}
// Busca todas as linhas (o Supabase devolve no máximo 1000 por vez)
export async function todos(tabela, montar = (c) => c) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const parte = await q(montar(sb.from(tabela).select("*")).range(de, de + 999));
    out.push(...parte);
    if (parte.length < 1000) break;
  }
  return out;
}
function traduzErro(m = "") {
  if (m.includes("row-level security") || m.includes("permission denied")) return "Sem permissão para essa ação.";
  if (m.includes("duplicate key")) return "Já existe um registro igual.";
  if (m.includes("Failed to fetch")) return "Sem conexão com o servidor.";
  if (m.includes("foreign key") || m.includes("violates")) return "Não foi possível salvar: existem lançamentos ligados a este registro.";
  return m;
}

// ---------- UI ----------
export function toast(msg, tipo = "") {
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  (document.getElementById("toasts") || document.body).appendChild(el);
  setTimeout(() => el.remove(), tipo === "erro" ? 6000 : 3000);
}

export function modal({ titulo, corpo, botoes = [], largura, aoAbrir }) {
  return new Promise((resolve) => {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo fin-modal";
    fundo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" ${largura ? `style="max-width:${largura}px"` : ""}>
        <header><h2>${esc(titulo)}</h2><button class="btn ghost sm" data-fechar aria-label="Fechar">✕</button></header>
        <div class="corpo">${corpo}</div>
        ${botoes.length ? `<footer>${botoes.map((b, i) => `<button class="btn ${b.classe || ""}" data-b="${i}">${esc(b.texto)}</button>`).join("")}</footer>` : ""}
      </div>`;
    const fechar = (v) => { fundo.remove(); document.removeEventListener("keydown", tecla); resolve(v); };
    const tecla = (e) => { if (e.key === "Escape") fechar(null); };
    document.addEventListener("keydown", tecla);
    fundo.addEventListener("mousedown", (e) => { if (e.target === fundo) fechar(null); });
    fundo.querySelector("[data-fechar]").onclick = () => fechar(null);
    fundo.querySelectorAll("[data-b]").forEach((btn) => {
      btn.onclick = async () => {
        const b = botoes[Number(btn.dataset.b)];
        if (!b.acao) return fechar(b.valor ?? null);
        btn.disabled = true;
        try {
          const r = await b.acao(fundo.querySelector(".modal"));
          if (r !== false) fechar(r ?? true);
        } catch (e) { console.error(e); } finally { btn.disabled = false; }
      };
    });
    document.body.appendChild(fundo);
    if (aoAbrir) aoAbrir(fundo.querySelector(".modal"));
    const primeiro = fundo.querySelector("input:not([type=checkbox]), select, textarea");
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
  });
}

export async function confirmar(texto, botao = "Excluir") {
  return modal({
    titulo: "Confirmar",
    corpo: `<p>${esc(texto)}</p>`,
    botoes: [{ texto: "Cancelar", valor: false }, { texto: botao, classe: "prim", valor: true }],
  });
}

// ---------- formulários por esquema ----------
// campo: { n, r: rótulo, t: text|number|money|int|date|month|textarea|select|check|url, o: opções | grupo OPC,
//          full, req, ph, ajuda, padrao, vazio, min, max }
export function formHTML(campos, valores = {}) {
  return `<form class="form-grid" onsubmit="return false">${campos.map((c) => campoHTML(c, valores[c.n])).join("")}</form>`;
}
function campoHTML(c, v) {
  const id = `f_${c.n}`;
  const req = c.req ? "required" : "";
  const ph = c.ph ? `placeholder="${esc(c.ph)}"` : "";
  const full = c.full || c.t === "textarea" ? "full" : "";
  if (c.t === "html") return `<div class="${full}" data-campo="${c.n}">${c.html || ""}</div>`;
  if (c.t === "check")
    return `<label class="campo check ${full}" data-campo="${c.n}"><input type="checkbox" name="${c.n}" ${(v ?? c.padrao) ? "checked" : ""}> ${esc(c.r)}</label>`;
  let input;
  if (c.t === "textarea") input = `<textarea id="${id}" name="${c.n}" ${req} ${ph}>${esc(v)}</textarea>`;
  else if (c.t === "select") {
    const opcs = typeof c.o === "string" ? OPC[c.o] : c.o;
    input = `<select id="${id}" name="${c.n}" ${req}>${c.vazio !== false ? `<option value="">${esc(c.vazio || "—")}</option>` : ""}${opcs
      .map((o) => `<option value="${esc(o[0])}" ${String(v ?? c.padrao ?? "") === String(o[0]) ? "selected" : ""}>${esc(o[1])}</option>`)
      .join("")}</select>`;
  } else {
    const tipo = { money: "number", number: "number", int: "number", date: "date", month: "month", url: "url" }[c.t] || "text";
    const step = c.t === "money" ? 'step="0.01" min="0" inputmode="decimal"' : c.t === "int" ? `step="1" min="${c.min ?? 0}" ${c.max ? `max="${c.max}"` : ""} inputmode="numeric"` : c.t === "number" ? 'step="any"' : "";
    const val = c.t === "month" && v ? String(v).slice(0, 7) : v;
    input = `<input type="${tipo}" id="${id}" name="${c.n}" value="${esc(val ?? c.padrao ?? "")}" ${step} ${req} ${ph}>`;
  }
  return `<label class="campo ${full}" for="${id}" data-campo="${c.n}">${esc(c.r)}${c.req ? " *" : ""}${input}${c.ajuda ? `<span class="small faint ajuda" style="font-weight:400">${c.ajuda}</span>` : ""}</label>`;
}
export function lerForm(raiz, campos) {
  const form = raiz.querySelector("form");
  if (!form.reportValidity()) return null;
  const out = {};
  for (const c of campos) {
    if (c.t === "html" || c.naoSalvar) continue;
    const el = form.elements[c.n];
    if (!el) continue;
    if (c.t === "check") out[c.n] = el.checked;
    else {
      const v = el.value.trim();
      if (v === "") out[c.n] = c.t === "money" && c.req ? 0 : null;
      else if (["number", "money", "int"].includes(c.t)) out[c.n] = Number(v);
      else if (c.t === "month") out[c.n] = v + "-01";
      else out[c.n] = v;
    }
  }
  return out;
}
export const valorCampo = (raiz, n) => raiz.querySelector(`form [name="${n}"]`)?.value ?? "";

// Formulário genérico em modal (insert/update/excluir)
export async function editar({ tabela, titulo, campos, registro = null, padroes = {}, antesDeSalvar, aoAbrir, aoExcluir, largura }) {
  const valores = { ...padroes, ...(registro || {}) };
  const botoes = [];
  if (registro)
    botoes.push({
      texto: "Excluir", classe: "perigo",
      acao: async () => {
        if (aoExcluir) return aoExcluir(registro);
        if (!(await confirmar("Excluir este registro? Essa ação não pode ser desfeita."))) return false;
        await q(sb.from(tabela).delete().eq("id", registro.id));
        toast("Excluído", "ok");
        return "excluido";
      },
    });
  botoes.push({ texto: "Cancelar", valor: null });
  botoes.push({
    texto: "Salvar", classe: "prim",
    acao: async (m) => {
      let dados = lerForm(m, campos);
      if (!dados) return false;
      if (antesDeSalvar) {
        dados = await antesDeSalvar(dados, registro, m);
        if (dados === false) return false;
        if (dados === "feito") { toast("Salvo", "ok"); return "salvo"; }
      }
      if (registro) await q(sb.from(tabela).update(dados).eq("id", registro.id));
      else await q(sb.from(tabela).insert(dados));
      toast("Salvo", "ok");
      return "salvo";
    },
  });
  return modal({ titulo: titulo || (registro ? "Editar" : "Novo"), corpo: formHTML(campos, valores), botoes, aoAbrir, largura });
}

// Seletor de mês ‹ Outubro de 2026 ›
export function seletorMes(mes) {
  return `<div class="mes-nav"><button class="btn sm" data-mes="-1" aria-label="Mês anterior">‹</button>
    <input type="month" value="${mes.slice(0, 7)}" data-mes-input aria-label="Escolher mês">
    <button class="btn sm" data-mes="1" aria-label="Próximo mês">›</button></div>`;
}
export function ligarSeletorMes(raiz, mes, addMeses, aoMudar) {
  raiz.querySelectorAll("[data-mes]").forEach((b) => (b.onclick = () => aoMudar(addMeses(mes, Number(b.dataset.mes)))));
  const inp = raiz.querySelector("[data-mes-input]");
  if (inp) inp.onchange = () => inp.value && aoMudar(inp.value + "-01");
}

export const barra = (fr, cor = "") => `<div class="barra ${cor}"><i style="width:${Math.max(0, Math.min(100, (fr || 0) * 100)).toFixed(1)}%"></i></div>`;
