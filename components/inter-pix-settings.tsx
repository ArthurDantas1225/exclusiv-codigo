"use client";
import { useEffect, useState } from "react";
import { getInterPixSettings, saveInterPixSettings } from "@/lib/pending-orders";
import { useStore } from "./provider";
import { Card, Field } from "./ui";
export function InterPixSettings() {
 const { notify, online } = useStore();
 const [config,setConfig]=useState({enabled:false,key:"",receiverName:"",city:""});
 const [loaded,setLoaded]=useState(false),[saving,setSaving]=useState(false);
 useEffect(()=>{let active=true;getInterPixSettings().then(settings=>{if(active){setConfig(settings);setLoaded(true);}}).catch(error=>notify(error instanceof Error?error.message:"Não foi possível carregar o Pix."));return()=>{active=false;};},[notify]);
 return <Card><details><summary>Configurar Pix do Inter</summary><p>Confira a chave e o favorecido no banco. Os novos pedidos usarão estes dados; pedidos anteriores manterão os dados originais.</p>
 <form onSubmit={async event=>{event.preventDefault();setSaving(true);try{await saveInterPixSettings(config);notify("Configuração Pix salva.");}catch(error){notify(error instanceof Error?error.message:"Não foi possível salvar o Pix.");}finally{setSaving(false);}}}>
 <fieldset disabled={!loaded||saving||!online}>
 <Field name="pix-key" label="Chave Pix aleatória"><input required value={config.key} onChange={e=>setConfig({...config,key:e.target.value})} autoComplete="off"/></Field>
 <Field name="pix-name" label="Nome do titular"><input required value={config.receiverName} onChange={e=>setConfig({...config,receiverName:e.target.value})} maxLength={25}/></Field>
 <Field name="pix-city" label="Cidade"><input required value={config.city} onChange={e=>setConfig({...config,city:e.target.value})} maxLength={15}/></Field>
 <label className="check"><input type="checkbox" checked={config.enabled} onChange={e=>setConfig({...config,enabled:e.target.checked})}/>Oferecer Pix no catálogo</label>
 <button type="submit">{saving?"Salvando…":"Salvar configuração Pix"}</button>
 </fieldset></form></details></Card>;
}
