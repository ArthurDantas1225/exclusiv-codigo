const appPath = (value: string) => /^\/app(?:\/|$)/.test(value) && !value.startsWith("//");

export function fallbackAppRoute(path: string) {
  if (!appPath(path)) return "/app";
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) return "/app";
  const section = parts[1];
  if (section === "produtos" || section === "inventario") return "/app/estoque";
  if (["clientes","vendas","financeiro","crm","relatorios","configuracoes","compras","fornecedores"].includes(section)) {
    return parts.length > 2 ? `/app/${section}` : "/app/mais";
  }
  return "/app";
}

export function rememberAppRoute(stack: string[], current: string) {
  const valid = stack.filter(appPath).slice(-30);
  if (!appPath(current) || valid.at(-1) === current) return valid;
  return [...valid,current].slice(-30);
}

export function previousAppRoute(stack: string[], current: string) {
  const valid = rememberAppRoute(stack,current);
  if (valid.length > 1) return { destination:valid[valid.length-2],stack:valid.slice(0,-1) };
  const destination = fallbackAppRoute(current);
  return { destination,stack:[destination] };
}
