import next from "eslint-config-next/core-web-vitals";
const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "catalog-site/**", "supabase-catalog/functions/**"] },
  { rules: { "react-hooks/set-state-in-effect": "off" } },
];

export default config;
