"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { decodePushPublicKey, notificationRequest, notificationWorker } from "@/lib/order-notifications";

export function OrderNotifications() {
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    setNeedsInstall(ios && !standalone);
    const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(capable);
    let active = true;
    if (capable) void (async () => {
      try {
        const registration = await notificationWorker();
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;
        const result = await notificationRequest({ action: "status", endpoint: subscription.endpoint });
        if (active) setEnabled(result.subscribed === true);
      } catch { /* Activation provides an actionable error; background inspection stays quiet. */ }
    })();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && capable) {
        void navigator.serviceWorker.ready.then(async (worker) => { await (await worker.pushManager.getSubscription())?.unsubscribe(); });
        if (active) setEnabled(false);
      }
    });
    return () => { active = false; listener?.data.subscription.unsubscribe(); };
  }, []);

  async function toggle() {
    setBusy(true); setMessage("");
    try {
      const permission = !enabled && Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (!enabled && permission !== "granted") throw new Error("Permita as notificações nas configurações do navegador para receber os avisos.");
      const worker = await notificationWorker();
      const existing = await worker.pushManager.getSubscription();
      if (enabled) {
        if (existing) {
          await notificationRequest({ action: "unsubscribe", endpoint: existing.endpoint });
          await existing.unsubscribe();
        }
        setEnabled(false); setMessage("Avisos desativados neste aparelho."); return;
      }
      const config = await notificationRequest({ action: "status" });
      if (!config.configured || !config.publicKey) throw new Error("Os avisos da loja ainda estão sendo configurados.");
      const subscription = existing ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodePushPublicKey(config.publicKey) });
      await notificationRequest({ action: "subscribe", subscription: subscription.toJSON() });
      setEnabled(true); setMessage("Você receberá avisos de Pix aguardando conferência e de pagamento conferido pela equipe.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível configurar os avisos."); }
    finally { setBusy(false); }
  }

  return <div className="card" style={{ marginBottom: 20 }}>
    <strong><Bell size={16} aria-hidden="true" /> Avisos de pedidos neste celular</strong>
    {needsInstall ? <p>Para receber no iPhone, abra este site no Safari, toque em Compartilhar → Adicionar à Tela de Início e abra o aplicativo pelo ícone.</p>
      : supported ? <><p>Receba um aviso quando um Pix aguardar conferência e quando a equipe confirmar o pagamento.</p><button type="button" className="ghost" disabled={busy} onClick={() => void toggle()}>{busy ? "Configurando…" : enabled ? "Desativar notificações" : "Ativar notificações"}</button></>
      : <p>Abra o app em um navegador atualizado com suporte a notificações.</p>}
    <p role="status" aria-live="polite">{message}</p>
  </div>;
}
