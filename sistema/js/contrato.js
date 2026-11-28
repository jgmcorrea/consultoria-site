// Contrato de prestação de serviço (aba "Contrato" da ficha da empresa).
// Monta o contrato de Responsabilidade Técnica com os dados da empresa, da proposta enviada e dos valores,
// no modelo da Isadora (Scoz 2026). Sai em PDF (janela de impressão) e em Word (.docx).
// Nada de CPF, RG ou endereço fica neste arquivo: os dados da contratada e de cada contrato
// são digitados no sistema e guardados só no banco (cons_config: "contratada" e "contrato:<id da empresa>").
(() => {
  const { S, esc, toast, hoje, fmtData, guardarLocal, render } = window.SIS;
  const PR = SIS.propostas;

  // ---------------------------------------------------------------------
  // utilidades
  // ---------------------------------------------------------------------
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (v) => brl.format(Number(v) || 0).replace(/ /g, " ");
  // "R$ 5.300,00", "5300", "5.300" ou "5300,50" → número
  const numero = (v) => {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    let t = String(v ?? "").replace(/[^\d.,]/g, "");
    if (!t) return 0;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    const n = Number(t);
    return isFinite(n) && n > 0 ? n : 0;
  };
  const horas = (v) => { const n = numero(v); return n ? String(n).replace(".", ",") : ""; };
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mesAno = (ym) => { const m = String(ym || "").match(/^(\d{4})-(\d{2})/); return m ? `${MESES[Number(m[2]) - 1]} de ${m[1]}` : ""; };

  // número por extenso (inteiros até 999.999.999)
  const UNI = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const CEN = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const ate999 = (n) => {
    if (n === 100) return "cem";
    const p = [];
    if (n >= 100) p.push(CEN[Math.floor(n / 100)]);
    const r = n % 100;
    if (r >= 20) { p.push(DEZ[Math.floor(r / 10)]); if (r % 10) p.push(UNI[r % 10]); }
    else if (r) p.push(UNI[r]);
    return p.join(" e ");
  };
  function inteiroExtenso(n) {
    n = Math.floor(n);
    if (!n) return "zero";
    const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1e3), r = n % 1e3, g = [];
    if (mi) g.push(mi === 1 ? "um milhão" : `${ate999(mi)} milhões`);
    if (mil) g.push(mil === 1 ? "um mil" : `${ate999(mil)} mil`);
    if (r) g.push(ate999(r));
    // "e" antes do último grupo quando ele é menor que 100 ou centena exata (mil e duzentos, mil e cinco)
    if (g.length > 1 && r && (r < 100 || r % 100 === 0)) return `${g.slice(0, -1).join(" ")} e ${g[g.length - 1]}`;
    return g.join(" ");
  }
  function reaisExtenso(v) {
    const tot = Math.round(numero(v) * 100), re = Math.floor(tot / 100), ce = tot % 100, p = [];
    if (re) p.push(`${inteiroExtenso(re)} ${re === 1 ? "real" : re % 1e6 === 0 ? "de reais" : "reais"}`);
    if (ce) p.push(`${inteiroExtenso(ce)} ${ce === 1 ? "centavo" : "centavos"}`);
    return p.join(" e ") || "zero real";
  }
  const valorExt = (v) => `${moeda(numero(v))} (${reaisExtenso(v)})`;

  // ---------------------------------------------------------------------
  // dados guardados (cons_config)
  // ---------------------------------------------------------------------
  const cfg = (chave) => S.dados.config.find((c) => c.chave === chave);
  async function salvarCfg(chave, valor) {
    const atual = cfg(chave);
    guardarLocal("config", await DB.salvar("config", { ...(atual ? { id: atual.id } : {}), chave, valor }));
  }
  // a contratada é a empresa da Isadora (pessoa jurídica), com ela como responsável técnica;
  // sem a razão social preenchida, o contrato sai no nome dela (pessoa física), como nos modelos antigos
  const CONTRATADA_PADRAO = () => ({ empresa: "", empresa_cnpj: "", empresa_sede: "", nome: "Isadora de Andrade Paulo", nacionalidade: "brasileira", estado_civil: "", profissao: "Engenheira de Alimentos", registro: "", rg: "", cpf: "", endereco: "", pagamento: "" });
  const contratada = () => ({ ...CONTRATADA_PADRAO(), ...(cfg("contratada")?.valor || {}) });

  const propostasDe = (id) => S.dados.propostas.filter((a) => a.prospect_id === id).sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || "")));
  // a proposta que vale para o contrato: a enviada mais recente; sem enviada, a mais recente
  const propostaBase = (p) => { const l = propostasDe(p.id); return l.find((x) => x.status === "enviada") || l[0] || null; };

  // o que a proposta de RT informa para o contrato
  function daProposta(prop) {
    const out = {};
    if (!prop) return out;
    const c = PR.normalizar(prop.conteudo);
    if (c.modelo !== "rt") return out;
    out.horas_presenciais = horas(c.horas_incluidas); out.horas_remotas = horas(c.horas_remotas);
    out.valor_mensal = numero(c.valor_mensal) || ""; out.hora_extra = numero(c.hora_adicional) || "";
    const b = !c.ocultar.formato && c.formato_blocos[0];
    if (b && b.titulo) { const resto = b.linhas.join(" ").replace(/\.\s*$/, ""); out.rotina = `${b.titulo.replace(/[:.]\s*$/, "")}${resto ? `, ${resto.charAt(0).toLowerCase()}${resto.slice(1)}` : ""}`; }
    if (!c.ocultar.condicoes) {
      const t = c.condicoes.join(" \n ");
      const m = t.match(/m[íi]nimo de (\d+) mes/i), a = t.match(/aviso pr[ée]vio de (\d+) dia/i);
      if (m) out.minimo_meses = m[1];
      if (a) out.aviso_dias = a[1];
      // compromissos da empresa que a proposta já trazia viram obrigações da contratante
      out.obrig_extra = c.condicoes.filter((x) => /compromete|n[ãa]o devem|dever[áa]/i.test(x) && !/prazo|aviso pr[ée]vio|proposta v[áa]lida|CREA|conselho/i.test(x));
    }
    if (c.registro) out.registro = c.registro;
    return out;
  }

  const CONTRATO_PADRAO = (p, prop) => {
    const d = daProposta(prop);
    return {
      proposta_id: prop?.id || "",
      razao: p.nome || "", cnpj: p.cnpj || "", sede: "", rep_nome: "", rep_qualif: "", rep_rg: "", rep_cpf: "", rep_endereco: "",
      inicio: hoje().slice(0, 7),
      horas_presenciais: d.horas_presenciais ?? "20", horas_remotas: d.horas_remotas ?? "", rotina: d.rotina || "",
      valor_mensal: d.valor_mensal ?? (Number(p.valor_proposto) || ""), hora_extra: d.hora_extra ?? "", dia_adicional: "", despesas: true,
      vencimento: "no 5º dia útil do mês subsequente ao serviço prestado",
      reajuste_mes: MESES[Number(hoje().slice(5, 7)) - 1], reajuste_indice: "INPC",
      multa_dias: "10", multa_pct: "10",
      minimo_meses: d.minimo_meses || "", aviso_dias: d.aviso_dias || "",
      obrig_extra: d.obrig_extra || [],
      foro: "Blumenau", foro_uf: "Santa Catarina", cidade: "Blumenau", data: hoje(), testemunhas: true,
    };
  };
  const contratoDe = (p) => { const v = cfg(`contrato:${p.id}`)?.valor; return v ? { ...CONTRATO_PADRAO(p, null), ...v } : null; };

  // ---------------------------------------------------------------------
  // texto do contrato: lista de blocos { t: "titulo" | "p" | "centro" | "espaco", partes: [[texto, negrito]] }
  // ---------------------------------------------------------------------
  const VAZIO = "__________";
  function montar(D, K) {
    const v = (x) => String(x ?? "").trim() || VAZIO;
    const B = [];
    const titulo = (t) => B.push({ t: "titulo", partes: [[t, true]] });
    const par = (...partes) => B.push({ t: "p", partes: partes.map((x) => (Array.isArray(x) ? x : [x, false])) });
    const hp = numero(D.horas_presenciais), hr = numero(D.horas_remotas), ht = hp + hr;
    const h = (n) => `${String(n).replace(".", ",")} ${n === 1 ? "hora" : "horas"}`;

    titulo("DAS PARTES");
    par(["Contratante: ", true], `${v(D.razao)}, pessoa jurídica de direito privado, inscrita no CNPJ nº ${v(D.cnpj)}, com sede em ${v(D.sede)}, doravante denominada CONTRATANTE e neste ato representada na forma de seus atos constitutivos, por seu representante legal ${v(D.rep_nome)}${D.rep_qualif ? `, ${D.rep_qualif.trim()}` : ""}, portador do Documento de Identidade RG nº ${v(D.rep_rg)}, inscrito no CPF sob o nº ${v(D.rep_cpf)}${D.rep_endereco ? `, residente e domiciliado em ${D.rep_endereco.trim()}` : ""}.`);
    const pj = !!String(K.empresa || "").trim();
    const qualif = [K.nacionalidade, K.estado_civil, K.profissao].filter((x) => String(x || "").trim()).map((x) => `, ${x.trim()}`).join("");
    if (pj) par(["Contratada: ", true], `${K.empresa.trim()}, pessoa jurídica de direito privado, inscrita no CNPJ nº ${v(K.empresa_cnpj)}, com sede em ${v(K.empresa_sede)}, doravante denominada CONTRATADA e neste ato representada por sua responsável técnica ${v(K.nome)}${qualif}, sob registro no ${v(K.registro)}${K.rg ? `, portadora do Documento de Identidade RG nº ${K.rg.trim()}` : ""}, inscrita no CPF sob o nº ${v(K.cpf)}${K.endereco ? `, residente e domiciliada em ${K.endereco.trim()}` : ""}.`);
    else par(["Contratada: ", true], `${v(K.nome)}${[K.nacionalidade, K.estado_civil, K.profissao].filter((x) => String(x || "").trim()).map((x) => `, ${x.trim()}`).join("")}, sob registro no ${v(K.registro)}${K.rg ? `, portadora do Documento de Identidade RG nº ${K.rg.trim()}` : ""}, inscrita no CPF sob o nº ${v(K.cpf)}, residente e domiciliada em ${v(K.endereco)}.`);
    par("Decidem as partes, na melhor forma de direito, celebrar o presente ", ["CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE RESPONSABILIDADE TÉCNICA E CONSULTORIA", true], ", que reger-se-á mediante as cláusulas e condições adiante estipuladas.");

    let c = 0, i = 0;
    const clausula = (nome) => { c++; i = 0; titulo(`CLÁUSULA ${["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA", "OITAVA"][c - 1]}: ${nome}`); };
    const item = (texto) => { i++; par([`${c}.${i} `, true], texto); return `${c}.${i}`; };

    clausula("DO OBJETO");
    item("O presente contrato tem por objeto a prestação de serviços de responsabilidade técnica por parte da CONTRATADA à CONTRATANTE, sem vínculo empregatício, de acordo com critérios, termos e condições detalhados neste contrato.");
    item(`A CONTRATADA${pj ? `, por meio de sua responsável técnica ${v(K.nome)},` : ""} providenciará junto ao CREA – Conselho Regional de Engenharia e Agronomia de Santa Catarina a emissão da anotação de função técnica referente ao serviço mencionado na cláusula 1.1.`);

    clausula("OBRIGAÇÕES DA CONTRATANTE");
    item("A CONTRATANTE deverá fornecer à CONTRATADA todas as informações necessárias à realização do serviço, devendo especificar os detalhes necessários à perfeita consecução do mesmo.");
    item("A CONTRATANTE possui completa responsabilidade pela veracidade das informações disponibilizadas à realização do serviço.");
    item("A CONTRATANTE deverá efetuar o pagamento na forma e condições estabelecidas na CLÁUSULA QUINTA.");
    for (const o of D.obrig_extra || []) if (String(o).trim()) item(/[.!?]$/.test(o.trim()) ? o.trim() : `${o.trim()}.`);

    clausula("OBRIGAÇÕES DA CONTRATADA");
    item("A CONTRATADA deverá prestar os serviços solicitados pela CONTRATANTE conforme descritivo, especificações e prazos previstos na CLÁUSULA QUARTA.");
    item("A CONTRATADA se obriga a manter absoluto sigilo sobre as operações, dados, estratégias, materiais, informações e documentos da CONTRATANTE, mesmo após a conclusão dos serviços ou do término da relação contratual.");
    item("Os contratos, informações, dados, materiais e documentos inerentes à CONTRATANTE ou a seus clientes deverão ser utilizados, pela CONTRATADA, estritamente para cumprimento dos serviços solicitados pela CONTRATANTE, sendo VEDADO a comercialização ou utilização para outros fins.");
    item("A CONTRATADA não assume nenhuma responsabilidade pelas consequências de qualquer natureza advindas de informações, declarações ou documentação inidôneas ou incompletas que lhe forem apresentadas, bem como por omissões próprias da CONTRATANTE ou decorrentes do desrespeito à orientação prestada para fins da prestação dos Serviços.");
    item("A CONTRATADA se compromete a colocar à disposição da CONTRATANTE para dúvidas sobre as informações, documentos, meios, necessários à realização dos Serviços aqui estipulados.");
    item("A CONTRATADA deverá fornecer os respectivos documentos fiscais, referente ao(s) pagamento(s) do presente instrumento.");

    clausula("DOS HORÁRIOS DE PRESTAÇÃO DO SERVIÇO");
    item("A CONTRATADA atuará nos serviços contratados nos horários descritos a seguir.");
    item(`Os serviços terão início em ${mesAno(D.inicio) || VAZIO}, devendo ser cumpridos e exercidos conforme as especificações descritas neste contrato.`);
    const min = numero(D.minimo_meses), av = numero(D.aviso_dias);
    item(min || av
      ? `O presente Contrato entrará em vigor na data de sua assinatura, por prazo indeterminado${min ? `, com período mínimo de ${min} ${min === 1 ? "mês" : "meses"}` : ""}. ${min ? "Após o período mínimo, poderá" : "Poderá"} ser encerrado por qualquer das partes${av ? `, mediante aviso prévio de ${av} dias` : ""}, com a respectiva baixa da Anotação de Responsabilidade Técnica (ART).`
      : "O presente Contrato entrará em vigor na data de sua assinatura e terá vigor até que uma das partes ou ambas decidam pela extinção do mesmo.");
    const onde = hp && hr ? `, sendo ${h(hp)} nas dependências da CONTRATANTE e ${h(hr)} de forma remota (online)` : hr ? ", de forma remota (online)" : ", nas dependências da CONTRATANTE";
    const refHoras = item(`Mensalmente, a CONTRATADA exercerá atividades à CONTRATANTE por ${ht ? h(ht) : `${VAZIO} horas`}${onde}.`);
    if (String(D.rotina || "").trim()) item(`Rotina de atendimento: ${D.rotina.trim().replace(/\.$/, "")}.`);
    item(`As horas excedentes às estipuladas na cláusula ${refHoras} serão caracterizadas como horas extras.`);

    clausula("DOS VALORES E FORMA DE PAGAMENTO");
    item(`Os pagamentos devidos pelo CONTRATANTE em razão do presente contrato serão realizados por meio de ${v(K.pagamento)}.`);
    const refValor = item(`O presente serviço será remunerado pela quantia de ${numero(D.valor_mensal) ? valorExt(D.valor_mensal) : VAZIO}, sendo que tal valor será pago mensalmente, até que seja encerrado este contrato, ${v(D.vencimento)}.`);
    item(`As horas extras prestadas pela CONTRATADA terão o valor de ${numero(D.hora_extra) ? valorExt(D.hora_extra) : VAZIO}, e estes serão pagos junto do valor que consta na cláusula ${refValor}.`);
    if (numero(D.dia_adicional)) item(`Caso seja necessário mais um dia de trabalho nas dependências da CONTRATANTE, será acrescido o valor de ${valorExt(D.dia_adicional)}.`);
    if (D.despesas && hp) item("As despesas com hospedagem e alimentação durante os períodos em que a CONTRATADA estiver nas dependências da CONTRATANTE, ficarão por conta da CONTRATANTE.");
    if (String(D.reajuste_mes || "").trim()) item(`Os valores referentes a este contrato serão atualizados anualmente no mês de ${D.reajuste_mes.trim().toLowerCase()} de acordo com a taxa ${v(D.reajuste_indice)} acumulada nos 12 meses anteriores.`);
    if (numero(D.multa_pct)) item(`No caso de atraso no pagamento superior a ${numero(D.multa_dias) || 10} dias, será devida multa moratória no valor de ${numero(D.multa_pct)}% (${inteiroExtenso(numero(D.multa_pct))} por cento), sobre a parcela inadimplida.`);

    clausula("DO FORO");
    item(`Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de ${v(D.foro)} do Estado de ${v(D.foro_uf)}.`);
    par("Por estarem assim justos e contratados, firmam o presente instrumento, em duas vias de igual forma e teor.");

    const centro = (t, neg = false) => B.push({ t: "centro", partes: [[t, neg]] });
    const espaco = () => B.push({ t: "espaco", partes: [] });
    espaco(); centro(`${v(D.cidade)}, ${D.data ? fmtData(D.data) : VAZIO}`, true);
    espaco(); espaco(); centro("__________________________________");
    if (pj) { centro(K.empresa.trim(), true); centro(`CNPJ: ${v(K.empresa_cnpj)}`); centro(`${v(K.nome)} – Responsável técnica`); }
    else { centro(v(K.nome), true); centro(`CPF: ${v(K.cpf)}`); }
    espaco(); espaco(); centro("__________________________________"); centro(v(D.razao), true); centro(`CNPJ: ${v(D.cnpj)}`);
    if (D.testemunhas) for (const n of [1, 2]) { espaco(); espaco(); centro("__________________________________"); centro(`Testemunha ${n}:`, true); }
    return B;
  }
  // campos que ainda saem em branco no contrato
  function pendencias(D, K) {
    const f = [];
    const q = (ok, nome) => { if (!ok) f.push(nome); };
    q(D.razao, "razão social"); q(D.cnpj, "CNPJ"); q(D.sede, "endereço da sede"); q(D.rep_nome, "nome do representante legal"); q(D.rep_rg, "RG do representante"); q(D.rep_cpf, "CPF do representante");
    q(numero(D.horas_presenciais) + numero(D.horas_remotas), "horas mensais"); q(numero(D.valor_mensal), "valor mensal"); q(numero(D.hora_extra), "valor da hora extra");
    q(K.empresa, "razão social da empresa da Isadora"); q(K.empresa_cnpj, "CNPJ da empresa da Isadora"); q(K.empresa_sede, "sede da empresa da Isadora");
    q(K.registro, "registro profissional da Isadora"); q(K.cpf, "CPF da Isadora"); q(K.pagamento, "forma de pagamento");
    return f;
  }

  // ---------------------------------------------------------------------
  // saída: PDF (janela de impressão) e Word
  // ---------------------------------------------------------------------
  const COR = "#D86143";
  function documentoHTML(D, K, { base = location.href, barraAcoes = true } = {}) {
    const logo = new URL("img/proposta/logo.png", base).href;
    const corpo = montar(D, K).map((b) => {
      const txt = b.partes.map(([t, n]) => (n ? `<b>${esc(t)}</b>` : esc(t))).join("");
      return b.t === "titulo" ? `<h2>${txt}</h2>` : b.t === "centro" ? `<p class="centro">${txt}</p>` : b.t === "espaco" ? `<p class="espaco">&nbsp;</p>` : `<p>${txt}</p>`;
    }).join("\n");
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(`Contrato RT - ${D.razao || "cliente"}`)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; background: #ECE9E6; font-family: Montserrat, Arial, sans-serif; color: #111; }
  .barra-acoes { position: sticky; top: 0; z-index: 9; display: flex; gap: 10px; justify-content: center; align-items: center; padding: 12px; background: #fff; border-bottom: 1px solid #ddd6d0; font: 13px Arial; }
  .barra-acoes button { font: 600 14px Arial; padding: 10px 18px; border-radius: 8px; border: 0; cursor: pointer; background: ${COR}; color: #fff; } .barra-acoes .sec { background: #ECE9E6; color: #333; }
  .folha { width: 210mm; min-height: 297mm; margin: 14px auto; padding: 20mm 18mm; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,.12); font-size: 11.5pt; line-height: 1.5; }
  .cab { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; }
  .cab h1 { margin: 0 0 3mm; font-size: 26pt; font-weight: 700; } .cab p { margin: 0; font-size: 13pt; line-height: 1.25; text-align: left; } .cab img { width: 27mm; height: 27mm; }
  h2 { margin: 7mm 0 3.5mm; padding: 1.6mm 4mm; font-size: 12pt; font-weight: 700; letter-spacing: .01em; background: linear-gradient(90deg, ${COR} 0%, #E9A08C 55%, #F6DAD2 100%); break-after: avoid; }
  p { margin: 0 0 3.5mm; text-align: justify; orphans: 3; widows: 3; } p.centro { text-align: center; margin: 0; break-inside: avoid; break-before: avoid; } p.espaco { margin: 0; height: 5mm; break-after: avoid; }
  @media print { html, body { background: #fff; } .barra-acoes { display: none; } .folha { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } }
</style></head><body>
${barraAcoes ? `<div class="barra-acoes"><button onclick="print()">⤓ Baixar PDF</button><span>Escolha <b>Salvar como PDF</b> e ative <b>Gráficos de plano de fundo</b>.</span><button class="sec" onclick="close()">Fechar</button></div>` : ""}
<div class="folha"><div class="cab"><div><h1>Contrato</h1><p>Prestação de serviço de<br>Responsabilidade Técnica</p></div><img src="${logo}" alt="Consultora Isadora Andrade"></div>
${corpo}
</div></body></html>`;
  }
  function abrirContrato(D, K) {
    const w = window.open("", "_blank");
    if (!w) return toast("Libere as janelas pop-up deste site para gerar o contrato.", true);
    w.document.write(documentoHTML(D, K)); w.document.close();
  }

  async function blobWord(D, K) {
    if (!window.docx) await SIS.rel.carregarScript("vendor/docx.iife.js");
    const d = window.docx, fonte = "Times New Roman", cor = "D86143";
    const run = (text, o = {}) => new d.TextRun({ text, font: fonte, size: o.size || 26, bold: !!o.bold, color: o.color || "000000" });
    const filhos = [
      new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 120 }, children: [run("Contrato", { size: 60, bold: true })] }),
      new d.Paragraph({ spacing: { after: 0 }, children: [run("Prestação de serviço de", { size: 32 })] }),
      new d.Paragraph({ spacing: { after: 360 }, children: [run("Responsabilidade Técnica", { size: 32 })] }),
    ];
    for (const b of montar(D, K)) {
      if (b.t === "espaco") { filhos.push(new d.Paragraph({ spacing: { after: 0 }, children: [run("")] })); continue; }
      filhos.push(new d.Paragraph({
        alignment: b.t === "centro" ? d.AlignmentType.CENTER : d.AlignmentType.JUSTIFIED,
        keepNext: b.t === "titulo",
        spacing: b.t === "titulo" ? { before: 320, after: 160 } : b.t === "centro" ? { after: 0 } : { after: 200 },
        children: b.partes.map(([t, n]) => run(t, { bold: n, color: b.t === "titulo" ? cor : undefined })),
      }));
    }
    const borda = { style: d.BorderStyle.SINGLE, size: 6, color: cor, space: 24 };
    const doc = new d.Document({
      sections: [{
        properties: { page: { size: { width: 11900, height: 16840 }, margin: { top: 1417, right: 1410, bottom: 1417, left: 992 },
          borders: { pageBorders: { offsetFrom: d.PageBorderOffsetFrom ? d.PageBorderOffsetFrom.PAGE : "page" }, pageBorderTop: borda, pageBorderRight: borda, pageBorderBottom: borda, pageBorderLeft: borda } } },
        children: filhos,
      }],
    });
    return d.Packer.toBlob(doc);
  }
  async function baixarWord(D, K) {
    SIS.rel.baixar(await blobWord(D, K), `Contrato RT - ${(D.razao || "cliente").replace(/[\\/:*?"<>|]/g, "")}.docx`);
  }

  // ---------------------------------------------------------------------
  // aba "Contrato" da ficha
  // ---------------------------------------------------------------------
  const E = { id: null, D: null, K: null, abrirK: false };
  function abaContrato(el, p) {
    if (DB.faltando.has("config")) { el.innerHTML = `<p class="pp-aviso">Para usar esta parte, falta preparar o banco: rode o arquivo <b>10_prospeccao_propostas.sql</b> no SQL Editor do Supabase e recarregue a página.</p>`; return; }
    const props = propostasDe(p.id), salvo = contratoDe(p);
    if (E.id !== p.id) { E.id = p.id; E.D = salvo || CONTRATO_PADRAO(p, propostaBase(p)); E.K = contratada(); E.abrirK = false; }
    const D = E.D, K = E.K;
    if (!K.registro && daProposta(props.find((x) => x.id === D.proposta_id)).registro) K.registro = daProposta(props.find((x) => x.id === D.proposta_id)).registro;
    const prop = props.find((x) => x.id === D.proposta_id);
    const soProjeto = prop && PR.normalizar(prop.conteudo).modelo !== "rt";
    const cliente = p.cliente_id || p.etapa === "fechado";
    const f = (obj, k, r, o = {}) => `<label class="campo ${o.largo ? "largo" : ""}"><span>${r}${o.dica ? ` <small class="pp-dica">· ${o.dica}</small>` : ""}</span>${o.area
      ? `<textarea data-${obj}="${k}" rows="${o.area}" placeholder="${esc(o.ph || "")}">${esc(Array.isArray((obj === "d" ? D : K)[k]) ? (obj === "d" ? D : K)[k].join("\n") : (obj === "d" ? D : K)[k] ?? "")}</textarea>`
      : `<input type="${o.tipo || "text"}" data-${obj}="${k}" value="${esc((obj === "d" ? D : K)[k] ?? "")}" placeholder="${esc(o.ph || "")}" ${o.tipo === "number" ? 'min="0" step="0.01" inputmode="decimal"' : ""}>`}</label>`;
    const faltaK = !K.empresa || !K.empresa_cnpj || !K.empresa_sede || !K.cpf || !K.registro || !K.pagamento;
    const pend = pendencias(D, K);
    el.innerHTML = `
      ${cliente ? "" : `<p class="pp-aviso">Esta empresa ainda não está como cliente (etapa “Fechado”). Dá para preparar o contrato desde já.</p>`}
      <section class="pp-card pp-largo">
        <div class="pp-card-cab"><h2>Contrato de Responsabilidade Técnica</h2><span class="chip ${salvo ? "ok" : "proximo"}">${salvo ? "Salvo" : "Ainda não salvo"}</span></div>
        <p class="dica">Os campos já vêm com os dados da empresa, da proposta e dos valores. Confira, complete o que falta e gere o contrato em PDF ou em Word.</p>
        ${soProjeto ? `<p class="pp-aviso">A proposta escolhida é do modelo de projeto, e por enquanto só existe o contrato de Responsabilidade Técnica: os valores abaixo não vieram dela.</p>` : ""}
        <div class="pp-botoes"><button class="botao" data-ct="salvar">Salvar</button><button class="botao-sec" data-ct="pdf">Visualizar / Baixar PDF</button><button class="botao-sec" data-ct="word">Baixar em Word</button>
          <span class="espaco"></span><button class="botao-sec" data-ct="recarregar" title="Refaz os campos de horas, valores e prazos a partir da proposta escolhida">Puxar dados da proposta de novo</button></div>
        ${pend.length ? `<p class="pp-aviso" data-pend>Ainda em branco no contrato (sai como “${VAZIO}”): ${esc(pend.join(", "))}.</p>` : ""}

        <div class="pp-editor">
          <details open class="pp-sec"><summary>1. Proposta de origem</summary><div class="grade-form">
            <label class="campo largo"><span>Proposta enviada ao cliente</span><select data-d="proposta_id"><option value="">Nenhuma (preencher à mão)</option>${props.map((x) => `<option value="${x.id}" ${x.id === D.proposta_id ? "selected" : ""}>${esc(x.titulo || "Proposta")} · ${esc(PR.nomeModelo(x.conteudo?.modelo))}${x.status === "enviada" ? " · enviada" : ""}</option>`).join("")}</select></label>
          </div></details>

          <details open class="pp-sec"><summary>2. Contratante (a empresa)</summary><div class="grade-form">
            ${f("d", "razao", "Razão social", { largo: true })}
            ${f("d", "cnpj", "CNPJ", { ph: "00.000.000/0000-00" })}
            ${f("d", "sede", "Endereço da sede", { ph: "rua, nº, bairro, cidade/UF, CEP" })}
            ${f("d", "rep_nome", "Representante legal")}
            ${f("d", "rep_qualif", "Qualificação do representante", { dica: "opcional", ph: "brasileiro, casado, empresário" })}
            ${f("d", "rep_rg", "RG do representante")}
            ${f("d", "rep_cpf", "CPF do representante", { ph: "000.000.000-00" })}
            ${f("d", "rep_endereco", "Endereço do representante", { largo: true, dica: "opcional" })}
          </div></details>

          <details open class="pp-sec"><summary>3. Horários e vigência</summary><div class="grade-form">
            ${f("d", "inicio", "Início dos serviços", { tipo: "month" })}
            ${f("d", "rotina", "Rotina de atendimento", { dica: "opcional", ph: "2 visitas presenciais mensais, preferencialmente na 1ª e 3ª semana de cada mês" })}
            ${f("d", "horas_presenciais", "Horas presenciais por mês")}
            ${f("d", "horas_remotas", "Horas remotas (online) por mês", { dica: "em branco se não houver" })}
            ${f("d", "minimo_meses", "Período mínimo (meses)", { dica: "em branco = sem período mínimo" })}
            ${f("d", "aviso_dias", "Aviso prévio para encerrar (dias)", { dica: "em branco = sem aviso prévio" })}
            ${f("d", "obrig_extra", "Obrigações adicionais da contratante", { largo: true, area: 3, dica: "uma por linha; entram depois da cláusula 2.3" })}
          </div></details>

          <details open class="pp-sec"><summary>4. Valores e pagamento</summary><div class="grade-form">
            ${f("d", "valor_mensal", "Valor mensal (R$)", { tipo: "number" })}
            ${f("d", "hora_extra", "Valor da hora extra (R$)", { tipo: "number" })}
            ${f("d", "dia_adicional", "Dia adicional nas dependências (R$)", { tipo: "number", dica: "em branco = sem essa cláusula" })}
            ${f("d", "vencimento", "Vencimento", { ph: "no 5º dia útil do mês subsequente ao serviço prestado" })}
            ${f("d", "reajuste_mes", "Mês do reajuste anual", { ph: "janeiro", dica: "em branco = sem reajuste" })}
            ${f("d", "reajuste_indice", "Índice do reajuste", { ph: "INPC" })}
            ${f("d", "multa_dias", "Multa: atraso superior a (dias)")}
            ${f("d", "multa_pct", "Multa (%)", { dica: "em branco = sem multa" })}
            <label class="pp-marca largo"><input type="checkbox" data-d="despesas" ${D.despesas ? "checked" : ""}> Hospedagem e alimentação nas visitas por conta da contratante</label>
            <p class="dica largo" data-extenso></p>
          </div></details>

          <details open class="pp-sec"><summary>5. Foro, data e assinaturas</summary><div class="grade-form">
            ${f("d", "foro", "Foro (comarca)")}${f("d", "foro_uf", "Estado do foro")}
            ${f("d", "cidade", "Cidade da assinatura")}${f("d", "data", "Data da assinatura", { tipo: "date" })}
            <label class="pp-marca largo"><input type="checkbox" data-d="testemunhas" ${D.testemunhas ? "checked" : ""}> Incluir as linhas de duas testemunhas</label>
          </div></details>

          <details ${faltaK || E.abrirK ? "open" : ""} class="pp-sec" data-sec-k><summary>6. Contratada (empresa da Isadora)${faltaK ? ` <span class="chip proximo">preencher uma vez</span>` : ""}</summary><div class="grade-form">
            <p class="dica largo">Preencha uma vez: esses dados ficam guardados no banco do sistema e entram em todos os contratos. O contrato sai no nome da empresa, com a Isadora como responsável técnica.</p>
            ${f("k", "empresa", "Razão social da empresa", { largo: true })}
            ${f("k", "empresa_cnpj", "CNPJ da empresa", { ph: "00.000.000/0000-00" })}
            ${f("k", "empresa_sede", "Sede da empresa", { ph: "rua, nº, complemento, município/UF, CEP" })}
            ${f("k", "pagamento", "Forma de pagamento (cláusula 5.1)", { largo: true, ph: "PIX (CNPJ: 00.000.000/0000-00)", dica: "o texto entra depois de “realizados por meio de”" })}
            <h3 class="largo pp-sub">Responsável técnica</h3>
            ${f("k", "nome", "Nome completo", { largo: true })}
            ${f("k", "nacionalidade", "Nacionalidade")}${f("k", "estado_civil", "Estado civil")}
            ${f("k", "profissao", "Profissão")}${f("k", "registro", "Registro profissional", { ph: "CREA-SC nº 000000-0" })}
            ${f("k", "cpf", "CPF", { ph: "000.000.000-00" })}${f("k", "rg", "RG", { dica: "opcional" })}
            ${f("k", "endereco", "Endereço residencial", { largo: true, dica: "opcional", ph: "rua, nº, complemento, município/UF" })}
          </div></details>
        </div>
        <div class="pp-botoes pp-fim"><span class="espaco"></span><button class="botao-sec" data-ct="word">Baixar em Word</button><button class="botao-sec" data-ct="pdf">Visualizar / Baixar PDF</button><button class="botao" data-ct="salvar">Salvar</button></div>
      </section>`;

    const ler = () => {
      el.querySelectorAll("[data-d]").forEach((i) => { const k = i.dataset.d; D[k] = i.type === "checkbox" ? i.checked : k === "obrig_extra" ? i.value.split("\n").map((x) => x.trim()).filter(Boolean) : i.value.trim(); });
      el.querySelectorAll("[data-k]").forEach((i) => { K[i.dataset.k] = i.value.trim(); });
    };
    const extenso = () => { ler(); const x = el.querySelector("[data-extenso]"); x.textContent = [numero(D.valor_mensal) && `Valor mensal: ${valorExt(D.valor_mensal)}.`, numero(D.hora_extra) && `Hora extra: ${valorExt(D.hora_extra)}.`].filter(Boolean).join(" "); };
    extenso();
    el.querySelectorAll('[data-d="valor_mensal"],[data-d="hora_extra"]').forEach((i) => (i.oninput = extenso));
    const salvar = async (silencioso) => {
      ler();
      await salvarCfg("contratada", K);
      await salvarCfg(`contrato:${p.id}`, D);
      if (!silencioso) toast("Contrato salvo.");
    };
    const tentar = (fn) => async (ev) => { ev.preventDefault(); try { await fn(ev); } catch (e) { SIS.falha(e); } };
    el.querySelectorAll('[data-ct="salvar"]').forEach((b) => (b.onclick = tentar(async () => { await salvar(); render(); })));
    el.querySelectorAll('[data-ct="pdf"]').forEach((b) => (b.onclick = tentar(async () => { await salvar(true); abrirContrato(D, K); })));
    el.querySelectorAll('[data-ct="word"]').forEach((b) => (b.onclick = tentar(async () => { await salvar(true); await baixarWord(D, K); toast("Contrato em Word baixado."); })));
    const puxar = () => { ler(); const novo = daProposta(props.find((x) => x.id === D.proposta_id)); delete novo.registro; Object.assign(D, novo); E.abrirK = el.querySelector("[data-sec-k]").open; render(); };
    el.querySelector('[data-ct="recarregar"]').onclick = () => { puxar(); toast("Horas, valores e prazos refeitos a partir da proposta."); };
    el.querySelector('[data-d="proposta_id"]').onchange = puxar;
  }

  SIS.contrato = { abaContrato, contratoDe, propostaBase, daProposta, montar, documentoHTML, blobWord, reaisExtenso, inteiroExtenso, numero, CONTRATO_PADRAO, contratada };
})();
