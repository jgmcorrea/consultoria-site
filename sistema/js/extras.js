// Financeiro (aba que reaproveita o Financeiro da Empresa) e Extrato de horas em PDF / Word
(() => {
  const { S, esc, toast, falha, hoje, fmtData, fmtDur, fmtDec, nomeMes, hora5, minutosDe, abrirModal, cliente, horasDe, cardsDe, gruposHoras, linhasTopicos } = window.SIS;

  // =====================================================================
  // FINANCEIRO
  // =====================================================================
  const SUBS = [
    ["inicio", "Visão do mês", "viewInicio"], ["lancamentos", "Entradas e saídas", "viewLancamentos"],
    ["fechamento", "Impostos e pró-labore", "viewFechamento"], ["projecao", "Projeção", "viewProjecao", "proj"], ["pf", "Pessoa física", "viewPF"],
    ["nfse", "Como emitir a NF", null, "local"],
    ["lembretes", "Lembretes", "viewLembretes", 2], ["config", "Configurações", "viewConfig", 2],
  ];

  // Passo a passo da emissão da NFS-e no Emissor Nacional (da planilha "passo a passo emissão NF empresa")
  const PASSOS_NF = [
    ["1. Pessoas", [
      ["Menu superior", "Selecionar “Emissão completa” (nunca a simplificada)"],
      ["Preencher as informações IBS/CBS?", "Não"],
      ["Data de Competência", "Data do dia da emissão"],
      ["Emitente da NFS-e", "“Prestador/Fornecedor”. Os dados já vêm preenchidos (Consultoria Isadora Andrade Ltda, Blumenau/SC)"],
      ["Regime de Apuração dos Tributos no Simples Nacional", "“Regime de apuração dos tributos federais e municipal pelo Simples Nacional” (1ª opção)"],
      ["Compras Governamentais", "Não preencher"],
      ["CNPJ do cliente", "Informar o CNPJ do tomador do serviço", "cnpj"],
      ["Destinatário do serviço", "Não preencher nada"],
      ["—", "Clicar em Avançar"],
    ]],
    ["2. Serviço", [
      ["Município", "Informar o município onde o serviço foi prestado", "cidade"],
      ["Código de Tributação Nacional", "17.01.01 – Consultoria técnica, Responsabilidade técnica"],
      ["O serviço/fornecimento prestado é um caso de: imunidade, exportação de serviço ou não incidência do ISSQN?", "Não"],
      ["NBS", "Não precisa preencher"],
      ["Descrição do serviço", "Ex.: “Consultoria técnica”, “Inspeção”", "descricao"],
      ["—", "Clicar em Avançar"],
    ]],
    ["3. Valores", [
      ["Valor do serviço", "Informar o valor do serviço prestado", "valor"],
      ["Exigibilidade do ISSQN suspensa?", "Não"],
      ["Retenção do ISSQN pelo Tomador/Intermediário?", "Não"],
      ["Serviço amparado por benefício municipal?", "Não"],
      ["Tributação Federal PIS/COFINS", "Deixar em branco"],
      ["Valor aproximado dos tributos", "“Informar alíquota do Simples Nacional”"],
      ["Alíquota", "6%"],
      ["—", "Clicar em Avançar"],
    ]],
    ["4. Emitir NFS-e", [
      ["Revisão/Emissão", "Revisar os dados exibidos na tela"],
      ["Revisão/Emissão", "Confirmar e emitir a NFS-e"],
    ]],
  ];
  // dados: valores do cliente/nota para mostrar ao lado do passo (cnpj, cidade, descricao, valor)
  function passosNF(dados = {}) {
    let n = 0;
    return `<div class="nf-passos">${PASSOS_NF.map(([etapa, itens]) => `
      <section class="nf-etapa"><h3>${etapa}</h3>
        <ol start="${n + 1}">${itens.map(([campo, fazer, chave]) => { n++; const extra = chave && dados[chave] ? `<span class="nf-dado">${esc(dados[chave])}</span>` : ""; return `
          <li><label><input type="checkbox"><span class="nf-campo"><b class="nf-num">${n}</b> ${esc(campo)}</span><span class="nf-fazer">${esc(fazer)}${extra}</span></label></li>`; }).join("")}</ol>
      </section>`).join("")}</div>`;
  }
  SIS.passosNF = passosNF;
  let mods = null;
  async function carregarModulos() {
    if (!mods) mods = window.FIN ? [window.FIN.T, window.FIN.T2, window.FIN.D, window.FIN.P]
      : await Promise.all([import("../financeiro/telas.js"), import("../financeiro/telas2.js"), import("../financeiro/dados.js"), import("../financeiro/projecao.js")]);
    return mods;
  }

  // Notas previstas para o mês "ymNota" (AAAA-MM): serviços do mês anterior (regra geral) ou,
  // para quem fatura no próprio mês, uma estimativa igual ao mês atual.
  function itensProjecao(ymNota) {
    const [a, m] = ymNota.split("-").map(Number);
    const ant = new Date(a, m - 2, 1); const ymAnt = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, "0")}`;
    const emAndamento = hoje().slice(0, 7) <= ymAnt;
    return S.dados.clientes.filter((c) => c.ativo !== false).sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome)).map((c) => {
      const mesmo = SIS.mesmoMes && SIS.mesmoMes(c);
      const serv = mesmo ? ymNota : ymAnt;
      const k = SIS.calcMes(c, serv);
      const jaEmitido = S.dados.faturas.filter((f) => f.cliente_id === c.id && f.mes.startsWith(serv)).reduce((s, f) => s + Number(f.valor || 0), 0);
      if (mesmo) {
        // ainda não há serviços do próprio mês: usa o mês anterior como estimativa
        const kAnt = SIS.calcMes(c, ymAnt);
        const usar = k.valor > 0 ? k : kAnt;
        return { id: c.id, nome: c.nome, servicos: `${serv}-01`, valor: usar.configurado ? usar.valor : 0, reembolso: (usar.reembolso || 0) + (usar.semNota || 0), jaEmitido,
          tipo: k.valor > 0 ? "lancado" : "estimativa", obs: k.valor > 0 ? "Fatura no próprio mês" : `Fatura no próprio mês: estimativa igual a ${nomeMes(ymAnt).toLowerCase()}` };
      }
      return { id: c.id, nome: c.nome, servicos: `${serv}-01`, valor: k.configurado ? k.valor : 0, reembolso: (k.reembolso || 0) + (k.semNota || 0), jaEmitido, tipo: "lancado",
        obs: !k.configurado ? "Forma de cobrança não cadastrada" : emAndamento ? `${nomeMes(ymAnt)} ainda em andamento: valor até hoje` : "" };
    });
  }

  SIS.telas.financeiro = async (el, r) => {
    S.lancSujo = true;
    const sub = SUBS.find((s) => s[0] === r.sub) || SUBS[0];
    el.innerHTML = `
      <header class="topo">
        <h1>Financeiro</h1>
        <p class="topo-meta">Entradas, saídas, impostos do Simples, pró-labore e lucros da empresa</p>
        <nav class="abas" role="tablist">${SUBS.map(([k, n]) => `<a role="tab" aria-selected="${k === sub[0]}" class="aba ${k === sub[0] ? "ativa" : ""}" href="#/financeiro/${k}">${n}</a>`).join("")}</nav>
      </header>
      <div class="fin" id="fin"><p class="carregando">Carregando…</p></div>`;
    const alvo = el.querySelector("#fin");
    if (sub[3] === "local") {
      alvo.innerHTML = `<div class="nf-pagina">
        <div class="nf-topo"><div><h2>Passo a passo da emissão da NFS-e</h2><p class="muted">Emissor Nacional. Marque cada passo conforme for preenchendo (as marcações não ficam salvas).</p></div>
          <a class="botao" href="https://www.nfse.gov.br/EmissorNacional" target="_blank" rel="noopener">Abrir Emissor Nacional</a></div>
        ${passosNF()}
        <p class="dica">Depois de emitir, registre a nota na aba Financeiro do cliente: ela entra sozinha em Entradas e saídas.</p></div>`;
      return;
    }
    try {
      const [T, T2, D, P] = await carregarModulos();
      D.invalidar();
      if (sub[3] === "proj") await P.viewProjecao(alvo, itensProjecao);
      else await (sub[3] === 2 ? T2 : T)[sub[2]](alvo);
    } catch (e) {
      console.error(e);
      alvo.innerHTML = `<div class="aviso-erro"><b>Não foi possível abrir o financeiro.</b><br>${esc(e.message || e)}<br><br>
        Confira se as tabelas do Financeiro da Empresa (emp_…) existem no mesmo projeto Supabase e se o seu login está liberado nelas.</div>`;
    }
  };

  // =====================================================================
  // EXTRATO DE HORAS
  // =====================================================================
  const carregados = {};
  function carregarScript(src) {
    return (carregados[src] ||= new Promise((ok, erro) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => erro(new Error("Não foi possível carregar " + src));
      document.head.appendChild(s);
    }));
  }
  function baixar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const nomeArquivo = (c, mes, ext) => `Extrato de horas - ${c.nome} - ${nomeMes(mes)}.${ext}`.replace(/[\\/:*?"<>|]/g, "-");

  function dadosExtrato(c, mes) {
    // um registro = um dia + uma descrição, com todos os horários dela (início e fim um embaixo do outro)
    const regs = gruposHoras(horasDe(c.id).filter((h) => h.data.startsWith(mes)))
      .sort((a, b) => a.data.localeCompare(b.data) || String(a.itens[0].inicio).localeCompare(String(b.itens[0].inicio)));
    const cards = cardsDe(c.id);
    const total = regs.reduce((s, g) => s + g.minutos, 0);
    const linhas = regs.map((g) => {
      const k = cards.find((x) => x.id === g.card_id);
      return { data: fmtData(g.data), inicio: g.itens.map((h) => hora5(h.inicio)).join("\n"), fim: g.itens.map((h) => hora5(h.fim)).join("\n"), dur: fmtDur(g.minutos), dec: fmtDec(g.minutos), atividade: (() => { const ls = linhasTopicos(g.descricao); return ls.length > 1 ? ls.map((l) => "• " + l).join("\n") : (ls[0] || ""); })() + (k ? `\n(${k.titulo})` : "") };
    });
    return { regs, linhas, total };
  }

  SIS.acoes.extrato = (el) => {
    const c = cliente(el.dataset.cliente);
    const meses = [...new Set(horasDe(c.id).map((h) => h.data.slice(0, 7)))].sort().reverse();
    const atual = hoje().slice(0, 7);
    if (!meses.includes(atual)) meses.unshift(atual);
    const inicial = S.mesHoras !== "todos" && meses.includes(S.mesHoras) ? S.mesHoras : meses.find((m) => horasDe(c.id).some((h) => h.data.startsWith(m))) || atual;
    abrirModal("Extrato de horas", `
      <label class="campo"><span>Mês</span>
        <select id="extrato-mes">${meses.map((m) => `<option value="${m}" ${m === inicial ? "selected" : ""}>${nomeMes(m)}</option>`).join("")}</select>
      </label>
      <div id="extrato-resumo" class="extrato-resumo"></div>
      <div class="extrato-botoes">
        <button type="button" class="botao" data-acao="extrato-baixar" data-formato="pdf" data-cliente="${c.id}">Baixar PDF</button>
        <button type="button" class="botao-sec" data-acao="extrato-baixar" data-formato="docx" data-cliente="${c.id}">Baixar Word</button>
      </div>`, null);
    const sel = document.getElementById("extrato-mes");
    const resumo = () => {
      const { regs, total } = dadosExtrato(c, sel.value);
      document.getElementById("extrato-resumo").innerHTML = regs.length
        ? `${nomeMes(sel.value)}: <b>${fmtDur(total)}</b> trabalhadas${valorDoMes(c, sel.value) !== null ? `, valor total de <b>${brl(valorDoMes(c, sel.value))}</b>` : ""}.`
        : `Nenhuma hora registrada em ${nomeMes(sel.value).toLowerCase()}. O extrato sairá vazio.`;
    };
    sel.addEventListener("change", resumo);
    resumo();
  };

  // usados também pelo relatório de containers (financeiro-cliente.js)
  SIS.rel = { carregarScript, baixar, carregarLogo: () => carregarLogo() };

  SIS.acoes["extrato-baixar"] = async (el) => {
    const c = cliente(el.dataset.cliente);
    const mes = document.getElementById("extrato-mes").value;
    el.disabled = true;
    const texto = el.textContent;
    el.textContent = "Gerando…";
    try {
      if (el.dataset.formato === "pdf") await gerarPDF(c, mes); else await gerarWord(c, mes);
      toast("Extrato gerado.");
    } catch (e) { falha(e); } finally { el.disabled = false; el.textContent = texto; }
  };

  const LARANJA = [226, 102, 26], TINTA = [30, 43, 39], CINZA = [86, 100, 94];
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // valor final do mês (o mesmo da aba Financeiro do cliente), sem detalhar o cálculo
  const valorDoMes = (c, mes) => { const k = SIS.calcMes ? SIS.calcMes(c, mes) : null; return k && k.configurado ? k.valor : null; };
  // logo da Isadora (imagens/logo.png do site), reduzida para não pesar no arquivo; sem ela o extrato sai normalmente
  let logoCache;
  function carregarLogo() {
    return (logoCache ||= new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement("canvas"); cv.width = cv.height = 280;
          const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 280, 280); ctx.drawImage(img, 0, 0, 280, 280);
          const url = cv.toDataURL("image/jpeg", 0.9); // fundo branco + JPEG: arquivo bem mais leve
          const bin = atob(url.split(",")[1]); const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          ok({ url, bytes });
        } catch { ok(null); }
      };
      img.onerror = () => ok(null);
      img.src = "../imagens/logo.png";
    }));
  }

  async function gerarPDF(c, mes) {
    if (!window.jspdf) await carregarScript("vendor/jspdf.umd.min.js");
    if (!window.jspdf.jsPDF.API.autoTable) await carregarScript("vendor/jspdf.plugin.autotable.min.js");
    const { jsPDF } = window.jspdf;
    const { linhas, total } = dadosExtrato(c, mes);
    const valor = valorDoMes(c, mes);
    const logo = await carregarLogo();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(...LARANJA); doc.rect(0, 0, W, 4, "F");
    if (logo) doc.addImage(logo.url, "JPEG", W - 15 - 30, 9, 30, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...LARANJA);
    doc.text("Consultoria Isadora Andrade", 15, 16);
    doc.setFontSize(19); doc.setTextColor(...TINTA);
    doc.text("Extrato de horas trabalhadas", 15, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...CINZA);
    let y = 35;
    const info = [["Cliente", c.razao_social || c.nome], ...(c.cnpj ? [["CNPJ", c.cnpj]] : []), ["Período", nomeMes(mes)]];
    info.forEach(([k, v]) => { doc.setFont("helvetica", "bold"); doc.text(k + ":", 15, y); doc.setFont("helvetica", "normal"); doc.text(String(v), 35, y); y += 6; });
    y += 2;
    doc.setDrawColor(220, 226, 222); doc.setFillColor(253, 238, 226); doc.roundedRect(15, y, W - 30, 14, 2, 2, "F");
    doc.setFontSize(11); doc.setTextColor(...TINTA); doc.setFont("helvetica", "bold");
    doc.text(`Total de horas: ${fmtDur(total)}`, 20, y + 9);
    if (valor !== null) doc.text(`Valor total: ${brl(valor)}`, W - 20, y + 9, { align: "right" });
    y += 20;
    doc.autoTable({
      startY: y,
      head: [["Data", "Início", "Fim", "Duração", "Atividade realizada"]],
      body: linhas.length ? linhas.map((l) => [l.data, l.inicio, l.fim, l.dur, l.atividade]) : [[{ content: "Nenhuma hora registrada neste mês.", colSpan: 5, styles: { halign: "center", textColor: CINZA } }]],
      foot: [["", "", "Total", fmtDur(total), valor !== null ? `Valor total: ${brl(valor)}` : ""]],
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9.5, cellPadding: 2.4, textColor: TINTA, lineColor: [220, 226, 222], lineWidth: 0.2, valign: "top" },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [242, 244, 242], textColor: TINTA, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 15 }, 2: { cellWidth: 15 }, 3: { cellWidth: 22 } },
      margin: { left: 15, right: 15, bottom: 18 },
      didDrawPage: () => {
        const H = doc.internal.pageSize.getHeight();
        doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal");
        doc.text(`Emitido em ${fmtData(hoje())}`, 15, H - 9);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - 15, H - 9, { align: "right" });
      },
    });
    baixar(doc.output("blob"), nomeArquivo(c, mes, "pdf"));
  }

  async function gerarWord(c, mes) {
    if (!window.docx) await carregarScript("vendor/docx.iife.js");
    const d = window.docx;
    const { linhas, total } = dadosExtrato(c, mes);
    const valor = valorDoMes(c, mes);
    const logo = await carregarLogo();
    const fonte = "Calibri";
    const t = (text, o = {}) => new d.TextRun({ text, font: fonte, size: o.size || 21, bold: o.bold, color: o.color || "1E2B27" });
    const borda = { style: d.BorderStyle.SINGLE, size: 4, color: "DCE2DE" };
    const bordas = { top: borda, bottom: borda, left: borda, right: borda };
    const larg = [1500, 1000, 1000, 1400, 4500];
    const cel = (txt, i, o = {}) => new d.TableCell({
      width: { size: larg[i], type: d.WidthType.DXA }, borders: bordas,
      shading: o.fundo ? { type: d.ShadingType.CLEAR, color: "auto", fill: o.fundo } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: String(txt).split("\n").map((p) => new d.Paragraph({ children: [t(p, { bold: o.bold, color: o.cor, size: 19 })] })),
    });
    const linhaT = (vals, o) => new d.TableRow({ children: vals.map((v, i) => cel(v, i, o)), tableHeader: o && o.cab });
    const corpo = linhas.length ? linhas.map((l) => linhaT([l.data, l.inicio, l.fim, l.dur, l.atividade])) : [linhaT(["", "", "", "", "Nenhuma hora registrada neste mês."])];
    const tabela = new d.Table({
      width: { size: 9400, type: d.WidthType.DXA }, columnWidths: larg,
      rows: [linhaT(["Data", "Início", "Fim", "Duração", "Atividade realizada"], { cab: true, bold: true, cor: "FFFFFF", fundo: "1E2B27" }), ...corpo,
        linhaT(["", "", "Total", fmtDur(total), valor !== null ? `Valor total: ${brl(valor)}` : ""], { bold: true, fundo: "F2F4F2" })],
    });
    const p = (runs, o = {}) => new d.Paragraph({ children: runs, spacing: { after: o.after ?? 80 } });
    const doc = new d.Document({
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1247, right: 1247 } } },
        footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [t(`Emitido em ${fmtData(hoje())} · Página `, { size: 16, color: "56645E" }), new d.TextRun({ children: [d.PageNumber.CURRENT], font: fonte, size: 16, color: "56645E" })] })] }) },
        children: [
          ...(logo ? [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, spacing: { after: 0 }, children: [new d.ImageRun({ type: "jpg", data: logo.bytes, transformation: { width: 96, height: 96 } })] })] : []),
          p([t("Consultoria Isadora Andrade", { bold: true, color: "E2661A", size: 20 })]),
          p([t("Extrato de horas trabalhadas", { bold: true, size: 34 })], { after: 200 }),
          p([t("Cliente: ", { bold: true }), t(c.razao_social || c.nome)]),
          ...(c.cnpj ? [p([t("CNPJ: ", { bold: true }), t(c.cnpj)])] : []),
          p([t("Período: ", { bold: true }), t(nomeMes(mes))]),
          p([t(`Total de horas: ${fmtDur(total)}`, { bold: true })], { after: valor !== null ? 80 : 240 }),
          ...(valor !== null ? [p([t(`Valor total: ${brl(valor)}`, { bold: true })], { after: 240 })] : []),
          tabela,
        ],
      }],
    });
    baixar(await d.Packer.toBlob(doc), nomeArquivo(c, mes, "docx"));
  }
})();
