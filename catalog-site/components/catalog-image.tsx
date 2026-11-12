"use client";
import NextImage, { type ImageProps } from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

function ImageResource(props: ImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="catalog-image-unavailable" role="img" aria-label={props.alt ? `${props.alt}: imagem indisponível` : "Imagem indisponível"}><ImageOff size={28} /><span>Imagem indisponível</span></span>;
  return <NextImage {...props} onError={() => setFailed(true)} />;
}

export default function CatalogImage(props: ImageProps) {
  return <ImageResource key={typeof props.src === "string" ? props.src : JSON.stringify(props.src)} {...props} />;
}
