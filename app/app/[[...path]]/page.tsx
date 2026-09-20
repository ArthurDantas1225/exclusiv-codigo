"use client";
import { useParams } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { Products } from "@/components/products";
import { Customers } from "@/components/customers";
import { POS } from "@/components/pos";
import { Sales } from "@/components/sales";
import { Finance } from "@/components/finance";
import { CRM } from "@/components/crm";
import { Reports } from "@/components/reports";
import { Inventory } from "@/components/inventory";
import { Settings, More, Alerts } from "@/components/settings";
import { Suppliers, Purchases, Payables } from "@/components/purchasing";
import { ImportCSV } from "@/components/import-csv";
import { Empty } from "@/components/ui";
export default function Page() {
  const params = useParams<{ path?: string[] }>();
  const [page, id] = params.path ?? [];
  switch (page) {
    case undefined:
      return <Dashboard />;
    case "vender":
      return <POS />;
    case "produtos":
      return <Products id={id} />;
    case "estoque":
      return <Products stock />;
    case "clientes":
      return <Customers id={id} />;
    case "vendas":
      return <Sales id={id} />;
    case "financeiro":
      return id === "pagar" ? <Payables /> : <Finance section={id} />;
    case "fornecedores":
      return <Suppliers />;
    case "compras":
      return <Purchases />;
    case "importar":
      return <ImportCSV />;
    case "crm":
      return <CRM />;
    case "relatorios":
      return <Reports />;
    case "inventario":
      return <Inventory />;
    case "configuracoes":
      return <Settings />;
    case "mais":
      return <More />;
    case "alertas":
      return <Alerts />;
    default:
      return <Empty title="Página não encontrada" />;
  }
}
