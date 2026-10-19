// Carrega todos os dados da empresa (volume pequeno: cabe tudo na memória)
import { sb, q, todos } from "./lib.js";

let cache = null;
export const invalidar = () => { cache = null; };

export const CONFIG_PADRAO = {
  empresa_nome: "Consultoria Isadora Andrade", socio_nome: "Isadora", data_abertura: "2026-09-01", saldo_inicial: 0,
  salario_minimo: 1621, aliq_inss: 11, teto_inss: 8475.55, fator_r_alvo: 30, reserva_pct: 10, presuncao_pct: 32,
  desconto_simplificado: 607.2, redutor_isento_ate: 5000, redutor_parcial_ate: 7350, redutor_constante: 978.62, redutor_fator: 0.133145,
  escrituracao: false, dia_das: 20, dia_darf: 20, dia_prolabore: 5, dias_alerta: 5,
  honorario_contador: 500, dia_contador: 25, contador_desde: "2026-10-01",
};

export async function carregar() {
  if (cache) return cache;
  const [lancamentos, fechamentos, lembretes, cfg] = await Promise.all([
    todos("emp_lancamentos", (c) => c.order("data", { ascending: false })),
    todos("emp_fechamentos"),
    todos("emp_lembretes", (c) => c.order("vencimento")),
    q(sb.from("emp_config").select("*").eq("id", 1)),
  ]);
  cache = { lancamentos, fechamentos, lembretes, config: { ...CONFIG_PADRAO, ...(cfg[0] || {}) } };
  return cache;
}
