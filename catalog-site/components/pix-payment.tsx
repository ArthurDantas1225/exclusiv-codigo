"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { money } from "@/lib/format";
import type { CatalogOrderReceipt } from "@/lib/order-client";

export function PixPayment({ receipt }: { receipt: CatalogOrderReceipt }) {
  const [qrCode, setQrCode] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const code = useRef<HTMLTextAreaElement>(null);
  const copyPaste = receipt.pix?.copyPaste ?? "";
  useEffect(() => {
    let active = true;
    void import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(copyPaste, {
      errorCorrectionLevel: "M", margin: 4, width: 280,
      color: { dark: "#000000", light: "#ffffff" },
    })).then((url) => { if (active) setQrCode(url); })
      .catch(() => { if (active) setQrFailed(true); });
    return () => { active = false; };
  }, [copyPaste]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyPaste);
      setCopyNotice("Código Pix copiado. Cole na opção Pix Copia e Cola do seu banco.");
    } catch {
      code.current?.focus();
      code.current?.select();
      setCopyNotice("Selecione e copie o código abaixo para colar no aplicativo do banco.");
    }
  }
  const paid = receipt.paymentStatus === "paid";
  return <section className="catalog-pix-payment" aria-labelledby="pix-payment-title">
    <h3 id="pix-payment-title">{paid ? "Pagamento confirmado" : "Pagar com Pix · Inter"}</h3>
    <p className="catalog-pix-status" role="status">{paid ? "Pago · confirmado pela equipe" : "Aguardando conferência"}</p>
    <p>Pedido <strong>{receipt.code}</strong> · <strong>{money(receipt.total)}</strong></p>
    {!paid && <>
      <p>Escaneie o QR Code ou copie o código para pagar no aplicativo do seu banco. Confira o valor e o recebedor <strong>{receipt.pix?.receiverName}</strong> antes de concluir.</p>
      <div className="catalog-pix-qr">
        {qrCode ? <Image src={qrCode} unoptimized alt={`QR Code Pix do pedido ${receipt.code}, no valor de ${money(receipt.total)}`} width={280} height={280} /> : <p role="status">{qrFailed ? "Use o Pix Copia e Cola abaixo para pagar." : "Gerando QR Code…"}</p>}
      </div>
      <label htmlFor="pix-copy-paste">Pix Copia e Cola</label>
      <textarea ref={code} id="pix-copy-paste" readOnly value={copyPaste} rows={3} spellCheck={false} />
      <button type="button" className="primary full" onClick={() => void copy()}><Copy size={17} /> Copiar código Pix</button>
      {copyNotice && <p className="fine" role="status">{copyNotice}</p>}
      <p className="fine">A equipe confere o recebimento no Inter. Seu pagamento só será marcado como confirmado depois dessa conferência. O pedido não reserva estoque.</p>
    </>}
    <a className="button ghost full" href={receipt.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Enviar pedido pelo WhatsApp</a>
  </section>;
}
