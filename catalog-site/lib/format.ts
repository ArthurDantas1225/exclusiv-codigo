export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const day = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export const cents = (value: FormDataEntryValue | null | string) =>
  Math.round(Number(String(value ?? "0").replace(",", ".")) * 100);
export function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, rawData = ""] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(rawData);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mime });
}
export function whatsapp(phone: string, message: string) {
  let n = phone.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  if (!/^\d{12,15}$/.test(n))
    throw new Error("Informe um WhatsApp válido com DDD.");
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}
export function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const text =
    "\uFEFF" +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(cell).join(";"))
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
