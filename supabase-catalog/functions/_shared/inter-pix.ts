export type PixSettings = { enabled: boolean; key: string; receiverName: string; city: string };
const ascii = (text: unknown, max: number) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 .-]/g, '').trim().slice(0,max);
export function normalizePixSettings(input: Record<string, unknown>): PixSettings {
  const key=String(input.key ?? '').trim().toLowerCase();
  const receiverName=ascii(input.receiverName,25), city=ascii(input.city,15);
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(key)||!receiverName||!city) throw new Error('Informe uma chave Pix aleatória válida, o titular e a cidade.');
  return { enabled: input.enabled === true, key, receiverName, city };
}
function field(id:string,value:string){if(value.length>99)throw new Error('Campo Pix inválido.');return id+String(value.length).padStart(2,'0')+value;}
export function buildPixPayload(input: PixSettings,total:number,reference:string) {
 const settings=normalizePixSettings(input);
 if(!settings.enabled||!Number.isSafeInteger(total)||total<=0||total>99999999999)throw new Error('Pagamento Pix indisponível.');
 const txid=reference.replace(/[^A-Za-z0-9]/g,'').slice(0,25);
 if(!txid)throw new Error('Referência Pix inválida.');
 const amount=(total/100).toFixed(2);
 const payload=field('00','01')+field('26',field('00','BR.GOV.BCB.PIX')+field('01',settings.key))+field('52','0000')+field('53','986')+field('54',amount)+field('58','BR')+field('59',settings.receiverName)+field('60',settings.city)+field('62',field('05',txid))+'6304';
 let crc=0xffff;for(const byte of new TextEncoder().encode(payload)){crc^=byte<<8;for(let bit=0;bit<8;bit++)crc=(crc&0x8000)?(crc<<1)^0x1021:crc<<1;crc&=0xffff;}
 return payload+crc.toString(16).toUpperCase().padStart(4,'0');
}
