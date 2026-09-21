# Estado da sessão — Meu Paraná

Última atualização: 20/09/2026

## Estado concluído

- Aplicativo Expo/React Native funcionando em web e com mapa SVG do Paraná, sem Google Maps e sem necessidade de faturamento.
- Firebase configurado para o projeto `meu-parana`.
- Aplicativo Web `Meu Paraná Web` registrado no Firebase.
- Login Google Web corrigido: o Web Client ID ativo está no `mobile/.env` e `http://localhost:8081` está autorizado como origem e redirecionamento.
- Provedor Google habilitado no Firebase Authentication.
- Cloud Firestore Standard criado em `southamerica-east1` (São Paulo).
- Coleção `cities` populada com 399 municípios do Paraná.
- Regras do Firestore publicadas a partir de `firebase/firestore.rules`.
- Os nomes dos 399 municípios aparecem desde a visão completa, em preto e sem sombra/contorno, e aumentam proporcionalmente com o zoom.
- O mapa aceita zoom pelos botões e gesto de pinça com dois dedos no celular, além do arraste quando aproximado.
- Compartilhamento de mapas implementado com código de 12 caracteres e link (`?share=CODIGO`).
- O proprietário escolhe entre `Somente leitura` e `Permitir alterações`, pode atualizar a permissão ou encerrar o convite.
- Um usuário autenticado pode colar um código/link, visualizar o mapa compartilhado e voltar ao próprio mapa.
- Compartilhamento social implementado: gera um cartão PNG vertical com mapa pintado, total visitado, percentual, progresso e legenda.
- No Android/iOS o PNG abre a folha nativa de compartilhamento; na Web usa Web Share quando disponível e baixa `meu-parana.png` como alternativa.
- Nome do aplicativo padronizado como `Meu Parana`.
- Novo ícone aplicado: silhueta do Paraná com araucária; versão opaca para iOS/Web e foreground transparente para o ícone adaptativo do Android.
- Cada visita guarda uma data escolhida pelo usuário e uma anotação pessoal de até 2.000 caracteres.
- A ficha da cidade separa a informação geral (somente leitura) da informação pessoal do usuário.
- Servidor local usado para desenvolvimento: `pnpm web -- --port 8081` dentro de `mobile/`.

## Próximos passos sugeridos

1. Criar e validar clientes OAuth Android e iOS para os testes nativos.
2. Revisar mensagens de erro, loading e estados offline.
3. Preencher gradualmente o campo de informação geral das cidades.
4. Remover ou proteger a conta de serviço que permanece somente na pasta Downloads; ela não está no repositório.

## Correção concluída após esta sessão

- O clique nos municípios e a confirmação de visita foram corrigidos na versão Web.
- Os elementos SVG agora usam o evento apropriado por plataforma, sem erros de responder no console.
- A confirmação de visita passou a ser exibida dentro do painel da cidade e funciona em Web, Android e iOS.
- Fluxo validado com Abatiá: seleção, gravação, pintura verde, atualização do contador e remoção do registro de teste.
- Novo fluxo validado com Abatiá: bloqueio de data inválida, gravação da data `15/09/2026`, exibição da anotação pessoal, edição para `16/09/2026` e remoção do registro temporário.
- As regras publicadas aceitam apenas `cityId`, `cityName`, `visitedDate`, `userInfo` e `updatedAt` nas visitas; a coleção `cities` continua sem escrita pelo cliente.
- Verificação final em uma aba limpa: TypeScript sem erros e console do navegador sem erros ou avisos.
- Zoom revisado: cliques rápidos em `+` e `−` são acumulados corretamente, os nomes também podem ser clicados e a pinça usa escala contínua entre 1x e 7x.
- Regras de compartilhamento publicadas no Firestore: códigos não podem ser listados, apenas consultados diretamente; visitas compartilhadas são protegidas pela permissão ativa.
- Teste isolado das regras concluído: leitura compartilhada `200`, exclusão em somente leitura bloqueada com `403`, exclusão com permissão de alteração autorizada com `200`; dados temporários removidos.
- Fluxo visual validado: criar convite, atualizar permissão, abrir por link, rejeitar código inválido, confirmar encerramento e revogar o convite temporário.
- Cartão social validado no navegador: captura PNG concluída sem erros e fallback de download acionado.
- Configuração pública do Expo validada com SDK 57, plugin `expo-sharing`, novo nome e novos ícones.

## Comandos úteis

```bash
cd mobile
pnpm web -- --port 8081
pnpm typecheck
```

O arquivo `mobile/.env` contém configurações locais e não deve ser versionado.
