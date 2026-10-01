"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ImageOff, Instagram, Maximize2, MessageCircle, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Trash2, X } from "lucide-react";
import { money } from "@/lib/format";
import { whatsappOrderUrl } from "@/lib/catalog-order";
import { galleryForColor, sortedColors, type CatalogImage } from "@/lib/catalog-selection";
import { catalogCategories, categoryForProduct, categoryNames, searchable, type CatalogCategory } from "@/lib/catalog-taxonomy";
import { savePendingOrder } from "@/lib/pending-orders";

type CatalogVariant = { id: string; product_id: string; size: string; color: string; model: string; stock: number };
type CatalogProduct = { id: string; name: string; category: string; subcategory?: string; collection: string; price: number; image: string | null; images: CatalogImage[]; variants: CatalogVariant[] };
export type CatalogData = { shop: string; products: CatalogProduct[] };
type CartLine = { variant: CatalogVariant; product: CatalogProduct; quantity: number };
type Selection = { productId: string; model: string; color: string; size: string; quantity: number; imageIndex: number };
const viewLabels: Record<string,string> = { front:"Frente", back:"Costas", detail:"Detalhe", other:"Foto" };
const instagram = "https://www.instagram.com/exclusiv_streetwear/";
const directWhatsApp = "https://wa.me/5584996008220?text=" + encodeURIComponent("Olá, EXCLUSIV! Gostaria de falar com a loja.");

export function PublicCatalog({ catalog }: { catalog: CatalogData }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [removed, setRemoved] = useState<CartLine | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [name, setName] = useState("");
  const [payment, setPayment] = useState("Pix");
  const [delivery, setDelivery] = useState("Retirada na loja");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory | "Todos">("Todos");
  const [subcategory, setSubcategory] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sort, setSort] = useState("recentes");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedProduct = catalog.products.find((product) => product.id === selection?.productId);
  const productVariants = selectedProduct?.variants.filter((variant) => variant.stock > 0) ?? [];
  const models = [...new Set(productVariants.map((variant) => variant.model))];
  const modelVariants = productVariants.filter((variant) => variant.model === selection?.model);
  const colors = sortedColors(modelVariants);
  const sizes = [...new Set(modelVariants.filter((variant) => variant.color === selection?.color).map((variant) => variant.size))];
  const selectedVariant = productVariants.find((variant) => variant.model === selection?.model && variant.color === selection?.color && variant.size === selection?.size);
  const photos = selectedProduct && selection ? galleryForColor(selectedProduct.images ?? [],selection.color) : [];
  const image = photos[selection?.imageIndex ?? 0];
  const genericPhoto = !!image && !image.color.trim();
  const allColors = [...new Set(catalog.products.flatMap((product) => product.variants.map((variant) => variant.color.trim()).filter(Boolean)))].sort();
  const allSizes = [...new Set(catalog.products.flatMap((product) => product.variants.map((variant) => variant.size.trim()).filter(Boolean)))].sort();
  const subcategories = category === "Todos"
    ? [...new Set(catalog.products.map((product) => product.subcategory?.trim()).filter((value): value is string => !!value))].sort()
    : [...new Set([...catalogCategories[category],...catalog.products.filter((product) => categoryForProduct(product.category,product.name) === category).map((product) => product.subcategory?.trim()).filter((value): value is string => !!value)])];
  const visibleProducts = catalog.products.filter((product) => {
    if (category !== "Todos" && categoryForProduct(product.category,product.name) !== category) return false;
    if (subcategory && product.subcategory?.trim() !== subcategory) return false;
    if (sizeFilter && !product.variants.some((variant) => variant.size.trim() === sizeFilter && variant.stock > 0)) return false;
    if (colorFilter && !product.variants.some((variant) => variant.color.trim() === colorFilter && variant.stock > 0)) return false;
    const haystack = searchable([product.name,product.category,product.subcategory ?? "",product.collection,...product.variants.flatMap((variant) => [variant.model,variant.color,variant.size])].join(" "));
    return haystack.includes(searchable(query));
  }).sort((a,b) => sort === "menor-preco" ? a.price-b.price : sort === "maior-preco" ? b.price-a.price : sort === "nome" ? a.name.localeCompare(b.name,"pt-BR") : 0);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 4000);
    return () => window.clearTimeout(timer);
  }, [removed]);
  useEffect(() => {
    if (!selection) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (lightboxIndex !== null) setLightboxIndex(null); else setSelection(null); }
      if (lightboxIndex !== null && selectedProduct?.images.length) {
        if (event.key === "ArrowLeft") setLightboxIndex((index) => ((index ?? 0)-1+selectedProduct.images.length)%selectedProduct.images.length);
        if (event.key === "ArrowRight") setLightboxIndex((index) => ((index ?? 0)+1)%selectedProduct.images.length);
      }
    };
    window.addEventListener("keydown",onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown",onKey); };
  }, [selection,lightboxIndex,selectedProduct]);
  function open(product: CatalogProduct) {
    const first = product.variants.find((variant) => variant.stock > 0);
    if (!first) return;
    setLightboxIndex(null);
    setSelection({ productId:product.id, model:first.model, color:first.color, size:first.size, quantity:1, imageIndex:0 });
  }
  function openLightbox() {
    if (!selectedProduct || !image) return;
    setLightboxIndex(Math.max(0,selectedProduct.images.findIndex((photo) => photo.id === image.id)));
  }
  function add() {
    if (!selection || !selectedProduct || !selectedVariant) return;
    const existing = cart.find((item) => item.variant.id === selectedVariant.id);
    const available = selectedVariant.stock - (existing?.quantity ?? 0);
    if (available < selection.quantity) { setNotice(`Restam ${available} unidade${available === 1 ? "" : "s"} desta opção.`); return; }
    setCart(existing
      ? cart.map((line) => line === existing ? { ...line, quantity:line.quantity + selection.quantity } : line)
      : [...cart,{variant:selectedVariant,product:selectedProduct,quantity:selection.quantity}]);
    setNotice(`${selectedProduct.name} adicionado ao pedido.`);
    setSelection(null);
  }
  function changeCart(id: string, delta: number) {
    const line = cart.find((item) => item.variant.id === id);
    if (line && line.quantity + delta <= 0) setRemoved(line);
    setCart(cart.flatMap((line) => line.variant.id !== id ? [line] :
      line.quantity + delta <= 0 ? [] : [{ ...line, quantity:Math.min(line.variant.stock,line.quantity + delta) }]));
  }
  function removeFromCart(line: CartLine) {
    setRemoved(line);
    setCart((current) => current.filter((item) => item.variant.id !== line.variant.id));
  }
  function undoCartRemoval() {
    if (!removed) return;
    const restored = removed;
    setCart((current) => {
      const existing = current.find((item) => item.variant.id === restored.variant.id);
      return existing ? current.map((item) => item === existing ? { ...item,quantity:Math.min(item.variant.stock,item.quantity + restored.quantity) } : item) : [...current,restored];
    });
    setRemoved(null);
  }
  const whatsapp = cart.length && name.trim() ? whatsappOrderUrl(cart,name,payment,delivery) : undefined;
  function persistOrder() {
    if (!whatsapp || !name.trim() || !cart.length) return;
    savePendingOrder({
      customerName: name.trim(),
      payment,
      delivery,
      items: cart.map((line) => ({
        productId: line.product.id,
        productName: line.product.name,
        variantId: line.variant.id,
        variantModel: line.variant.model,
        variantColor: line.variant.color,
        variantSize: line.variant.size,
        quantity: line.quantity,
        unitPrice: line.product.price,
      })),
    });
  }
  return <main className="catalog-page">
    <header className="catalog-header"><div className="wordmark">EXCLUSIV<span>®</span></div><span>CATÁLOGO ONLINE</span><a className="catalog-header-cart" href="#pedido" aria-label={`Ver meu pedido, ${count} peças`}><ShoppingBag size={17} /> Pedido · {count}</a></header>
    <section className="catalog-intro">
      <h1>Escolha suas peças exclusivas</h1>
      <p>Explore as peças, escolha sua cor e tamanho e envie seu pedido para a EXCLUSIV.</p>
      <div className="catalog-socials">
        <a href={instagram} target="_blank" rel="noopener noreferrer" className="button"><Instagram size={18} /> @exclusiv_streetwear</a>
        <a href={directWhatsApp} target="_blank" rel="noopener noreferrer" className="button"><MessageCircle size={18} /> Falar com a loja</a>
        <a href="#pedido" className="button primary"><ShoppingBag size={18} /> Meu pedido · {count}</a>
      </div>
    </section>
    <section className="catalog-discovery" aria-label="Pesquisar e filtrar produtos">
      <label className="catalog-search"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar peça, modelo, cor ou tamanho" aria-label="Pesquisar produtos" /></label>
      <div className="catalog-categories" role="group" aria-label="Categorias principais">
        {(["Todos",...categoryNames] as const).map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => { setCategory(item); setSubcategory(""); }}>{item}</button>)}
      </div>
      <details className="catalog-filters"><summary><SlidersHorizontal size={17} /> Mais filtros{[subcategory,sizeFilter,colorFilter].filter(Boolean).length ? ` · ${[subcategory,sizeFilter,colorFilter].filter(Boolean).length} ativos` : ""}</summary>
        <div className="catalog-filter-grid">
          <label>Subcategoria<select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="">Todas</option>{subcategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Tamanho<select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}><option value="">Todos</option>{allSizes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Cor<select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)}><option value="">Todas</option>{allColors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Ordenar<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recentes">Mais recentes</option><option value="menor-preco">Menor preço</option><option value="maior-preco">Maior preço</option><option value="nome">Nome</option></select></label>
        </div>
        <button className="ghost catalog-clear" onClick={() => { setQuery(""); setCategory("Todos"); setSubcategory(""); setSizeFilter(""); setColorFilter(""); setSort("recentes"); }}>Limpar filtros</button>
      </details>
      {(query || category !== "Todos" || subcategory || sizeFilter || colorFilter) && <div className="catalog-active-filters" aria-label="Filtros aplicados">
        {query && <button onClick={() => setQuery("")}>Busca: {query} <X size={13} /></button>}
        {category !== "Todos" && <button onClick={() => { setCategory("Todos"); setSubcategory(""); }}>Categoria: {category} <X size={13} /></button>}
        {subcategory && <button onClick={() => setSubcategory("")}>Tipo: {subcategory} <X size={13} /></button>}
        {sizeFilter && <button onClick={() => setSizeFilter("")}>Tamanho: {sizeFilter} <X size={13} /></button>}
        {colorFilter && <button onClick={() => setColorFilter("")}>Cor: {colorFilter} <X size={13} /></button>}
      </div>}
      <p className="fine">{visibleProducts.length} {visibleProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
    </section>
    <div className="catalog-layout">
      <section className="catalog-grid" aria-label="Produtos disponíveis">
        {!catalog.products.length && <div className="catalog-empty"><ShoppingBag size={28} /><h2>Novidades a caminho</h2><p>Volte em breve para conferir as peças publicadas.</p></div>}
        {!!catalog.products.length && !visibleProducts.length && <div className="catalog-empty"><Search size={28} /><h2>Nenhuma peça encontrada</h2><p>Experimente outro termo ou limpe os filtros.</p><button className="ghost" onClick={() => { setQuery(""); setCategory("Todos"); setSubcategory(""); setSizeFilter(""); setColorFilter(""); }}>Limpar filtros</button></div>}
        {visibleProducts.map((product) => <article className="catalog-card" key={product.id}>
          <button className="catalog-open" onClick={() => open(product)} disabled={!product.variants.some((variant) => variant.stock > 0)} aria-label={`Ver detalhes de ${product.name}`}>
            <div className="catalog-photo">{product.image ? <Image unoptimized src={product.image} alt={product.name} width={800} height={800} sizes="(max-width: 600px) 46vw, (max-width: 850px) 46vw, 30vw" /> : <ImageOff size={40} />}</div>
            <div className="catalog-card-body"><small>{categoryForProduct(product.category,product.name)}{product.subcategory ? ` · ${product.subcategory}` : ""}</small><h2>{product.name}</h2><strong>{money(product.price)}</strong><span>{product.variants.some((variant) => variant.stock > 0) ? `${new Set(product.variants.filter((variant) => variant.stock > 0).map((variant) => variant.color)).size} cores · ${new Set(product.variants.filter((variant) => variant.stock > 0).map((variant) => variant.size)).size} tamanhos` : "Sem estoque"} <ArrowRight size={16} /></span></div>
          </button>
        </article>)}
      </section>
      <aside className="catalog-cart" id="pedido">
        <div className="card-head"><h2>Meu pedido</h2><ShoppingBag size={21} /></div>
        {!cart.length ? <p className="muted">Abra uma peça, escolha cor, tamanho e quantidade.</p> : cart.map((line) => <div className="catalog-cart-line" key={line.variant.id}>
          <div><strong>{line.product.name}</strong><small>{line.variant.model ? `${line.variant.model} · ` : ""}{line.variant.color} · {line.variant.size}</small><b>{money(line.product.price * line.quantity)}</b></div>
          <div className="catalog-qty"><button aria-label={`Diminuir ${line.product.name}`} onClick={() => changeCart(line.variant.id,-1)}><Minus size={16} /></button><span>{line.quantity}</span><button aria-label={`Aumentar ${line.product.name}`} disabled={line.quantity >= line.variant.stock} onClick={() => changeCart(line.variant.id,1)}><Plus size={16} /></button><button aria-label={`Remover ${line.product.name}`} onClick={() => removeFromCart(line)}><Trash2 size={16} /></button></div>
        </div>)}
        <div className="total-row total"><span>Total estimado</span><span>{money(total)}</span></div>
        <label htmlFor="buyer-name">Seu nome</label><input id="buyer-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Como podemos chamar você?" />
        <label htmlFor="buyer-payment">Como prefere pagar?</label><select id="buyer-payment" value={payment} onChange={(e) => setPayment(e.target.value)}>{["Pix","Dinheiro","Cartão de débito","Cartão de crédito","A combinar"].map((item) => <option key={item}>{item}</option>)}</select>
        <label htmlFor="buyer-delivery">Como quer receber?</label><select id="buyer-delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}>{["Retirada na loja","Entrega a combinar"].map((item) => <option key={item}>{item}</option>)}</select>
        <a className={`button primary full ${!whatsapp ? "disabled-link" : ""}`} href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (!whatsapp) { event.preventDefault(); setNotice("Informe seu nome e adicione uma peça."); return; } persistOrder(); }}>Enviar pedido no WhatsApp <ArrowRight size={18} /></a>
        <p className="fine">Seu pedido será enviado para (84) 99600-8220. A loja confirma disponibilidade e pagamento; o envio não reserva estoque.</p>
      </aside>
    </div>
    {!!count && <a className="catalog-mobile-cart" href="#pedido"><ShoppingBag size={19} /> Ver pedido · {count} peça{count === 1 ? "" : "s"}<strong>{money(total)}</strong></a>}
    {selection && selectedProduct && <div className="catalog-detail-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelection(null); }}>
      <section className="catalog-detail" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selectedProduct.name}`}>
        <button className="catalog-detail-back" aria-label="Voltar ao catálogo" onClick={() => setSelection(null)}><ArrowLeft size={18} /> Voltar ao catálogo</button>
        <button className="catalog-detail-close icon-button" aria-label="Fechar produto" onClick={() => setSelection(null)} autoFocus><X size={22} /></button>
        <div className="catalog-detail-gallery">
          {image ? <button type="button" className="catalog-detail-main-photo" onClick={openLightbox} aria-label="Ampliar imagem e ver todas as fotos"><Image unoptimized src={image.url} alt={`${selectedProduct.name} · ${genericPhoto ? "imagem geral" : image.color} · ${viewLabels[image.view] ?? "Foto"}`} width={900} height={900} /><span className="catalog-zoom-hint"><Maximize2 size={16} /> Ampliar</span></button> : <div className="catalog-detail-main-photo"><div className="catalog-photo-empty"><ImageOff size={38} /><span>Foto de {selection.color} ainda não disponível</span></div></div>}
          {image && <p className="fine catalog-photo-caption">{genericPhoto ? `Imagem geral; a foto da peça na cor ${selection.color.trim()} ainda não foi identificada.` : `Foto da cor ${image.color.trim()} · ${viewLabels[image.view] ?? "Foto"}${image.color.trim().toLocaleLowerCase("pt-BR") !== selection.color.trim().toLocaleLowerCase("pt-BR") ? `. A cor escolhida é ${selection.color.trim()}.` : ""}`}</p>}
          {!!photos.length && <div className="catalog-thumbnails">{photos.map((photo,index) => <button className={index === selection.imageIndex ? "selected" : ""} key={photo.id} onClick={() => setSelection({ ...selection,imageIndex:index })} aria-label={`${photo.color.trim() || "Imagem geral"} · ${viewLabels[photo.view] ?? "Foto"} ${index+1}`}><Image unoptimized src={photo.url} alt="" width={96} height={96} /><span>{photo.color.trim() || "Geral"} · {viewLabels[photo.view] ?? "Foto"}</span></button>)}</div>}
          {photos.length > 1 && <div className="catalog-gallery-arrows"><button aria-label="Foto anterior" onClick={() => setSelection({ ...selection,imageIndex:(selection.imageIndex - 1 + photos.length) % photos.length })}><ChevronLeft size={19} /></button><button aria-label="Próxima foto" onClick={() => setSelection({ ...selection,imageIndex:(selection.imageIndex + 1) % photos.length })}><ChevronRight size={19} /></button></div>}
          {!!photos.length && <button type="button" className="ghost catalog-all-photos" onClick={openLightbox}><Maximize2 size={16} /> Ver todas as fotos · {selectedProduct.images.length}</button>}
        </div>
        <div className="catalog-detail-info">
          <small>{selectedProduct.collection || selectedProduct.category || "EXCLUSIV"}</small><h2>{selectedProduct.name}</h2><strong className="catalog-detail-price">{money(selectedProduct.price)}</strong>
          {models.length > 1 && <div className="catalog-option"><h3>Modelo</h3><div className="catalog-option-chips">{models.map((model) => <button key={model} className={model === selection.model ? "selected" : ""} onClick={() => { const first = productVariants.find((variant) => variant.model === model)!; setSelection({ ...selection,model,color:first.color,size:first.size,quantity:1,imageIndex:0 }); }}>{model || "Padrão"}</button>)}</div></div>}
          <div className="catalog-option"><h3>Cor <span>{selection.color}</span></h3><div className="catalog-option-chips">{colors.map((color) => <button key={color} className={color === selection.color ? "selected" : ""} onClick={() => { const first = modelVariants.find((variant) => variant.color === color)!; setSelection({ ...selection,color,size:first.size,quantity:1,imageIndex:0 }); }}>{color}</button>)}</div></div>
          <div className="catalog-option"><h3>Tamanho <span>{selection.size}</span></h3><div className="catalog-option-chips">{sizes.map((size) => <button key={size} className={size === selection.size ? "selected" : ""} onClick={() => setSelection({ ...selection,size,quantity:1 })}>{size}</button>)}</div></div>
          <p className="fine">{selectedVariant?.stock ?? 0} {selectedVariant?.stock === 1 ? "unidade disponível" : "unidades disponíveis"} nesta opção</p>
          <div className="catalog-detail-buy"><div className="catalog-qty"><button aria-label="Diminuir quantidade" disabled={selection.quantity <= 1} onClick={() => setSelection({ ...selection,quantity:selection.quantity-1 })}><Minus size={18} /></button><span>{selection.quantity}</span><button aria-label="Aumentar quantidade" disabled={selection.quantity >= (selectedVariant?.stock ?? 0)} onClick={() => setSelection({ ...selection,quantity:selection.quantity+1 })}><Plus size={18} /></button></div><button className="primary" onClick={add} disabled={!selectedVariant}>Adicionar · {money(selectedProduct.price * selection.quantity)}</button></div>
        </div>
      </section>
    </div>}
    {selection && selectedProduct && lightboxIndex !== null && selectedProduct.images[lightboxIndex] && <div className="catalog-lightbox-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setLightboxIndex(null); }}>
      <section className="catalog-lightbox" role="dialog" aria-modal="true" aria-label={`Todas as fotos de ${selectedProduct.name}`}>
        <div className="catalog-lightbox-head"><button className="catalog-lightbox-back" onClick={() => setLightboxIndex(null)}><ArrowLeft size={18} /> Voltar ao produto</button><div><strong>{selectedProduct.name}</strong><span>{selectedProduct.images[lightboxIndex].color.trim() || "Imagem geral"} · {viewLabels[selectedProduct.images[lightboxIndex].view] ?? "Foto"} · {lightboxIndex+1}/{selectedProduct.images.length}</span></div></div>
        <div className="catalog-lightbox-stage"><button aria-label="Imagem anterior" disabled={selectedProduct.images.length < 2} onClick={() => setLightboxIndex((lightboxIndex-1+selectedProduct.images.length)%selectedProduct.images.length)}><ChevronLeft size={26} /></button><Image unoptimized src={selectedProduct.images[lightboxIndex].url} alt={`${selectedProduct.name} · ${selectedProduct.images[lightboxIndex].color.trim() || "Imagem geral"} · ${viewLabels[selectedProduct.images[lightboxIndex].view] ?? "Foto"}`} width={1600} height={1600} /><button aria-label="Próxima imagem" disabled={selectedProduct.images.length < 2} onClick={() => setLightboxIndex((lightboxIndex+1)%selectedProduct.images.length)}><ChevronRight size={26} /></button></div>
        <div className="catalog-lightbox-thumbs">{selectedProduct.images.map((photo,index) => <button key={photo.id} className={index === lightboxIndex ? "selected" : ""} onClick={() => setLightboxIndex(index)} aria-label={`Ver ${photo.color.trim() || "imagem geral"} · ${viewLabels[photo.view] ?? "Foto"}`}><Image unoptimized src={photo.url} alt="" width={90} height={90} /><span>{photo.color.trim() || "Geral"} · {viewLabels[photo.view] ?? "Foto"}</span></button>)}</div>
      </section>
    </div>}
    {notice && <div className={`toast catalog-toast ${count ? "has-cart" : ""}`} role="status" onClick={() => setNotice("")}>{notice}</div>}
    {removed && <div className={`undo-toast catalog-undo ${count ? "has-cart" : ""}`} role="status"><span>Peça removida.</span><button onClick={undoCartRemoval}>Desfazer</button></div>}
    <footer className="catalog-footer">EXCLUSIV · Seu estilo, sua rua.</footer>
  </main>;
}
