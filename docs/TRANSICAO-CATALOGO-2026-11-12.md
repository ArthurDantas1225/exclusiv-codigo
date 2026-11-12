# Transição visual do catálogo EXCLUSIV

## Entrega

Branch local `codex/catalogo-visual-aprovado`, baseada em `759966df85519249379189403ffcb45a433ce864`. Alterações limitadas ao catálogo separado e documentação. Não houve push, publicação, alteração de domínio, migration ou gravação em serviços da loja.

Visual aprovado aplicado: fundo #141414, laranja #ff730a, Funnel Sans e Lora, abertura central e grade discreta. Fontes servidas pelo próprio Next.js após build. Fotografias, nomes e valores continuam vindo da integração existente. Nenhum produto de demonstração da primeira prévia foi incluído na página de produção.

## Problemas confirmados e corrigidos

- Cor e tamanho filtrados separadamente podiam retornar uma combinação inexistente. Agora devem pertencer à mesma variante com estoque positivo.
- Resposta HTML/não JSON do serviço causava erro de parser. Agora há mensagem controlada.
- O cliente aceitava redirecionamentos arbitrários em respostas de pedido. Agora valida HTTPS e domínio `wa.me` com caminho numérico.
- Pedidos sem resposta podiam deixar o usuário sem orientação. Há prazo de 15 segundos, erro persistente em português e repetição com a mesma chave.
- Dados do pedido permanecem bloqueados quando o resultado do envio é incerto. Isso impede gerar uma nova chave ao editar enquanto o pedido pode já ter sido registrado. Rejeição explícita permite corrigir o formulário.
- Retorno do WhatsApp após sucesso tem ações para reabrir o mesmo pedido ou começar um novo, gerando nova chave deliberadamente.
- Foco em detalhe e galeria fica contido e retorna à peça ao fechar. Removido autofocus que capturava incorretamente o botão de fechar como origem.
- Imagens quebradas recebem placeholder acessível e não impedem escolha de variantes.

## Evidências

- Suite do aplicativo: **78 testes, 78 passaram**. Inclui estoque, vendas, isolamento, sincronização, pedidos e promoções, em ambiente de teste.
- Suite do catálogo: **19 testes, 19 passaram**; inclui 7 novos casos de filtro/resposta/recuperação, além dos 12 originais.
- `pnpm exec eslint .`, executado em `catalog-site`: sem erros.
- `pnpm exec tsc --noEmit`, executado em `catalog-site`: sem erros.
- `pnpm exec next build`, executado em `catalog-site`: concluído com sucesso, incluindo TypeScript.
- Revisão independente encontrou problemas de foco, pedido incerto e retorno após sucesso; foram corrigidos. Revisão final não identificou outros P1/P2 na última alteração.

No navegador, com fixture local e sem endpoint de escrita real:

- Frente/detalhe, troca de cor e tamanho e adição ao carrinho.
- Fechamento por Escape e foco restaurado; galeria aninhada retorna ao produto.
- Combinação Azul + M sem estoque conjunto retorna estado vazio; limpar restaura produtos.
- Foto inválida exibe mensagem acessível.
- Rejeição HTTP 409 mostra erro e libera formulário.
- Conexão interrompida mantém formulário e carrinho bloqueados. Duas tentativas consecutivas chegaram ao serviço local com a mesma chave.
- Larguras simuladas 320, 375, 390, 430, 768 e 1440 px sem transbordamento horizontal.

## Executar revisão local

Instale com `pnpm install --frozen-lockfile` na raiz do repositório. Em `catalog-site`, execute em um terminal:

```powershell
node tests/manual/catalog-fixture.mjs
```

Em outro terminal, também em `catalog-site`:

```powershell
$env:NEXT_PUBLIC_CATALOG_SUPABASE_URL='http://127.0.0.1:4180'
$env:NEXT_PUBLIC_CATALOG_SUPABASE_PUBLISHABLE_KEY='local-test-only'
$env:NEXT_PUBLIC_CATALOG_ORDER_URL='http://127.0.0.1:4180/create-order'
pnpm exec next dev --port 4174
```

Acesse http://localhost:4174. A fixture fornece produtos identificados como TESTE LOCAL e rejeita pedidos por padrão. Sua configuração não deve ser usada em hospedagem. Para simular conexão interrompida, faça GET local em `http://127.0.0.1:4180/mode?value=drop`; `value=reject` restaura rejeição controlada. GET `/status` informa tentativas e chaves apenas da fixture. Nenhuma venda é criada.

O carregamento de promoções existente continua consultando a projeção pública do ERP, inclusive nessa revisão. Isso é somente leitura; promoções que aceitem categorias gerais podem aparecer aplicadas às peças locais. As regras foram preservadas, não reconfiguradas.

## Limites e verificações antes da substituição

- Testes locais reduzem risco; não garantem ausência absoluta de bugs.
- Não houve teste em aparelho físico.
- Não foi registrada venda real nem pedido em produção. Validar catálogo → pedido → confirmação no ERP → estoque em ambiente apropriado antes de promover a mudança.
- Voltar do WhatsApp com bfcache e o caminho feliz na plataforma real precisam de teste controlado; a ação de novo pedido foi implementada e revisada, sem abrir atendimento real nesta sessão.
- A recuperação de pedido incerto vale para a aba aberta. Recarregar/fechar perde o estado em memória, como no fluxo anterior; o aviso orienta manter a aba aberta. Persistência de rascunho entre sessões não foi adicionada.
- O estoque exibido é o snapshot carregado. A sincronização continua existente e o servidor revalida no envio; esta entrega não acrescenta assinatura realtime ou atualização automática da página já aberta.
- Vídeos persistentes não fazem parte da integração de fotos atual e não foram adicionados nesta transição.
- Confirmar o destino final e as variáveis da hospedagem. Manter Root Directory `catalog-site`. Não usar valores locais da fixture. Conferir HTTPS, imagens reais, fontes, contato oficial e ausência de bloqueio indevido de indexação.
- A autorização original exige confirmação explícita antes de substituir o catálogo atual.

## Reversão

Como não há mudança de banco ou protocolo, voltar à versão anterior do catálogo exige apenas restaurar a versão de hospedagem anterior ou reverter o commit desta branch e publicar novamente. Não reverter migrations nem apagar produtos/pedidos. Se houver novos commits no remoto, reaplicar/revisar a alteração sobre o estado atualizado antes de integrar.
