"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ImageOff, RefreshCw, Shirt, Sparkles } from "lucide-react";
import { useStore } from "./provider";
import { Card, Empty } from "./ui";
import { money } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  buildStylistCandidates,
  fallbackStylistResult,
  findStylistReplacement,
  validateStylistResult,
  type StylistCandidate,
  type StylistGoal,
  type StylistPairing,
  type StylistResult,
} from "@/lib/stylist";

const pairingOptions: Array<{ value: StylistPairing; label: string }> = [
  { value: "shirt_short", label: "Camisa + Short" },
  { value: "shirt_pants", label: "Camisa + Calça" },
];
const goalOptions: Array<{ value: StylistGoal; label: string }> = [
  { value: "sell_today", label: "Vender hoje" },
  { value: "new_arrivals", label: "Divulgar novidades" },
  { value: "move_stock", label: "Girar estoque" },
];

export function Stylist() {
  const { data } = useStore();
  const [pairing, setPairing] = useState<StylistPairing>("shirt_short");
  const [goal, setGoal] = useState<StylistGoal>("sell_today");
  const [result, setResult] = useState<StylistResult | null>(null);
  const [selectedKit, setSelectedKit] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const candidates = useMemo(() => buildStylistCandidates({
    products: data.products,
    variants: data.product_variants,
    images: data.product_images,
  }, pairing, goal), [data.products, data.product_variants, data.product_images, pairing, goal]);

  useEffect(() => {
    setResult(null);
    setSelectedKit(0);
    setStatus("");
  }, [pairing, goal]);

  useEffect(() => {
    if (!supabase || !candidates.length) return;
    const imageIds = [...new Set(candidates.flatMap((candidate) => [candidate.top.imageId, candidate.bottom.imageId]))];
    const photos = imageIds.map((id) => data.product_images.find((photo) => photo.id === id)).filter((photo) => photo !== undefined);
    if (!photos.length) return;
    let mounted = true;
    void supabase.storage.from("products").createSignedUrls(photos.map((photo) => photo.path), 3600).then(({ data: signed }) => {
      if (mounted) setPhotoUrls(Object.fromEntries(photos.map((photo, index) => [photo.id, signed?.[index]?.signedUrl ?? ""])));
    });
    return () => { mounted = false; };
  }, [candidates, data.product_images]);

  async function requestSuggestions(available: StylistCandidate[]) {
    if (!available.length) return null;
    const local = fallbackStylistResult(available[0], goal);
    try {
      if (!supabase) throw new Error("Serviço indisponível");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const response = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pairing, goal, candidates: available.slice(0, 12) }),
      });
      if (!response.ok) throw new Error("Não foi possível consultar o Stylist IA");
      const payload: unknown = await response.json();
      const remote = payload && typeof payload === "object" && "result" in payload ? payload.result : null;
      const checked = validateStylistResult(remote, available, data.product_variants);
      if (!checked) throw new Error("Sugestão incompatível com o estoque atual");
      setStatus(payload && typeof payload === "object" && "source" in payload && payload.source === "ai"
        ? "Combinações criadas com o Stylist IA."
        : "Sugestão local pronta; o serviço de IA não estava disponível.");
      return checked;
    } catch {
      setStatus("Sugestão local pronta; o serviço de IA não estava disponível.");
      return local;
    }
  }

  async function generate(available = candidates) {
    if (busy || !available.length) return;
    setBusy(true);
    setStatus("Analisando as peças disponíveis…");
    try {
      const next = await requestSuggestions(available);
      if (next) {
        setResult(next);
        setSelectedKit(0);
      }
    } finally {
      setBusy(false);
    }
  }

  function changePiece() {
    const currentId = result?.kits[selectedKit]?.candidateId;
    const replacement = currentId ? findStylistReplacement(candidates, currentId) : undefined;
    if (!replacement) {
      setStatus("Não há outra combinação disponível para estas escolhas.");
      return;
    }
    setResult(fallbackStylistResult(replacement, goal));
    setSelectedKit(0);
    setStatus("Peça trocada usando as opções disponíveis no estoque.");
  }

  async function regenerateText() {
    const id = result?.kits[selectedKit]?.candidateId;
    const candidate = candidates.find((entry) => entry.id === id);
    if (candidate) await generate([candidate]);
  }

  async function copyScript() {
    const kit = result?.kits[selectedKit];
    if (!kit || kit.story.length !== 3) return;
    const text = [kit.title, "", kit.caption, "", ...kit.story.flatMap((frame, index) => [`Story ${index + 1} — ${frame.headline}`, frame.body, ""]), kit.cta].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Roteiro copiado. Agora é só montar os Stories com as fotos indicadas.");
    } catch {
      setStatus("Não foi possível copiar automaticamente. Tente novamente.");
    }
  }

  return (
    <div className="stylist-page">
      <div className="page-heading stylist-heading">
        <div>
          <div className="eyebrow"><Sparkles size={14} /> STYLIST IA</div>
          <h1>Combinações prontas para seus Stories.</h1>
          <p>Escolha o tipo de kit e o objetivo. Usamos somente peças, tamanhos e fotos que já estão no estoque.</p>
        </div>
      </div>

      <Card className="stylist-controls">
        <fieldset>
          <legend>Qual combinação?</legend>
          <div className="stylist-choice-grid">
            {pairingOptions.map((option) => <button type="button" key={option.value} className={pairing === option.value ? "selected" : ""} onClick={() => setPairing(option.value)}><Shirt size={19} />{option.label}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Qual objetivo?</legend>
          <div className="stylist-goals">
            {goalOptions.map((option) => <button type="button" key={option.value} className={goal === option.value ? "selected" : ""} onClick={() => setGoal(option.value)}>{option.label}</button>)}
          </div>
        </fieldset>
        <button type="button" className="primary full stylist-generate" disabled={busy || !candidates.length} onClick={() => void generate()}><Sparkles size={19} />{busy ? "Criando combinações…" : "Gerar combinações"}</button>
        <p className="fine">{candidates.length} combinações reais encontradas. A IA recebe apenas informações comerciais das peças, nunca clientes, custos ou fotos.</p>
      </Card>

      <div className="stylist-status" aria-live="polite">{status}</div>

      {!candidates.length && <Empty title="Ainda não há peças compatíveis" text="Cadastre fotos, cores, tamanhos e estoque positivo para gerar combinações."><Link className="button primary" href="/app/estoque">Revisar estoque</Link></Empty>}

      {result && <div className="stylist-results">
        <div className="stylist-result-tabs" aria-label="Combinações sugeridas">
          {result.kits.map((kit, index) => <button type="button" key={kit.candidateId} className={selectedKit === index ? "selected" : ""} onClick={() => setSelectedKit(index)}>Kit {index + 1}</button>)}
        </div>
        {result.kits.map((kit, index) => {
          if (index !== selectedKit || kit.story.length !== 3) return null;
          const candidate = candidates.find((entry) => entry.id === kit.candidateId);
          if (!candidate) return null;
          return <Card className="stylist-kit" key={kit.candidateId}>
            <div className="stylist-photos">
              {[candidate.top, candidate.bottom].map((piece) => <div className="stylist-photo" key={`${piece.productId}-${piece.color}`}>
                {photoUrls[piece.imageId] ? <img /* eslint-disable-line @next/next/no-img-element -- signed private Storage URL */ src={photoUrls[piece.imageId]} alt={`${piece.name} na cor ${piece.color}`} /> : <ImageOff aria-label="Foto indisponível" />}
                <span>{piece.name}</span><small>{piece.color} · {piece.sizes.join(", ")}</small><strong>{money(piece.price)}</strong>
              </div>)}
            </div>
            <div className="stylist-kit-copy"><span className="badge warning">Kit {index + 1}</span><h2>{kit.title}</h2><p>{kit.caption}</p><strong>Total {money(candidate.totalPrice)}</strong></div>
            <div className="stylist-story">
              <h3>Roteiro de Story</h3>
              {kit.story.map((frame, frameIndex) => <article key={frameIndex}><span>{frameIndex + 1}</span><div><strong>{frame.headline}</strong><p>{frame.body}</p></div></article>)}
              <p className="stylist-cta">{kit.cta}</p>
            </div>
            <div className="stylist-actions">
              <button type="button" className="primary" onClick={() => void copyScript()}><Copy size={17} />Copiar roteiro</button>
              <button type="button" onClick={changePiece}><RefreshCw size={17} />Trocar uma peça</button>
              <button type="button" disabled={busy} onClick={() => void regenerateText()}><Sparkles size={17} />Gerar outro texto</button>
            </div>
          </Card>;
        })}
      </div>}
    </div>
  );
}
