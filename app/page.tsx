"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const kind = new URLSearchParams(window.location.hash.slice(1)).get("type");
    const fromInvite = kind === "invite" || kind === "recovery";
    const fromCode = new URLSearchParams(window.location.search).has("code");
    if (fromInvite || fromCode) {
      window.location.replace("/definir-senha" + window.location.search + window.location.hash);
    } else {
      router.replace("/app");
    }
  }, [router]);
  return <main className="login" aria-label="Abrindo EXCLUSIV" />;
}
