# Meu Paraná

Aplicativo React Native para marcar, em um mapa interativo, os municípios do Paraná já visitados por cada usuário.

## Arquitetura

- **Expo SDK 57 + React Native** no aplicativo móvel.
- **Firebase Authentication** com login Google.
- **Cloud Firestore** para os 399 municípios, perfis e visitas.
- **IBGE + SVG local** para a lista oficial e o mapa vetorial interativo, sem Google Maps.

O Firestore usa estas coleções:

```text
cities/{ibgeCode}
  ibgeCode, name, state, region, info

users/{firebaseUid}
  displayName, email, photoURL, lastLoginAt

users/{firebaseUid}/visits/{ibgeCode}
  cityId, cityName, visitedAt
```

Cada usuário só pode ler e alterar o próprio perfil e a própria subcoleção `visits`. O cadastro de cidades é somente leitura no aplicativo.

## 1. Configurar o Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Em **Authentication > Sign-in method**, habilite o provedor Google.
3. Crie um banco **Cloud Firestore**.
4. Registre um aplicativo Web e copie a configuração pública do Firebase.
5. No Google Cloud do mesmo projeto, crie clientes OAuth Web, Android e iOS.
   - Android: pacote `br.com.meuparana.app` e o SHA-1 da assinatura.
   - iOS: bundle ID `br.com.meuparana.app`.

Copie [`mobile/.env.example`](./mobile/.env.example) para `mobile/.env` e preencha os valores. Não é necessário habilitar faturamento nem criar uma chave do Google Maps. As configurações `EXPO_PUBLIC_*` fazem parte do binário e não são segredos; a segurança dos dados é garantida pelo Firebase Authentication e pelas regras do Firestore.

## 2. Publicar as regras do Firestore

Na pasta `firebase`, copie `.firebaserc.example` para `.firebaserc`, informe o ID do projeto e execute:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

As regras estão em [`firebase/firestore.rules`](./firebase/firestore.rules).

## 3. Cadastrar os 399 municípios

Crie uma conta de serviço no Firebase/Google Cloud e aponte `GOOGLE_APPLICATION_CREDENTIALS` para o JSON baixado. O JSON é secreto e não deve ser versionado.

```bash
cd tools
pnpm install
FIREBASE_PROJECT_ID=seu-projeto \
GOOGLE_APPLICATION_CREDENTIALS=/caminho/seguro/service-account.json \
pnpm seed:cities
```

O script consulta o IBGE, valida que recebeu exatamente 399 municípios e grava `name`, `state`, `region` e `info`. Execuções futuras atualizam os dados oficiais sem apagar textos já preenchidos em `info`.

## 4. Executar o aplicativo

```bash
cd mobile
pnpm install
pnpm start
```

O fluxo OAuth usa `expo-auth-session` e pode ser testado em um development build. Para gerar os projetos nativos e executar no Android:

```bash
pnpm expo prebuild
pnpm expo run:android
```

No iOS, execute `pnpm expo run:ios` em um macOS ou use EAS Build. Depois de alterar IDs OAuth, scheme ou chave de mapas, gere um novo binário.

## 5. Gerar build Android (EAS)

O `mobile/eas.json` tem dois profiles:

- `preview` — gera `.apk` (distribuição `internal`, instala direto no aparelho, sem Play Store).
- `production` — gera `.aab` (App Bundle, para publicar na Play Store).

```bash
cd mobile
eas build --platform android --profile preview
```

Se o binário `eas` não estiver instalado global, use `npx eas-cli` no lugar de `eas`.

Pra forçar um build limpo (ignorando cache de uma build anterior):

```bash
eas build --platform android --profile preview --clear-cache
```

As variáveis `EXPO_PUBLIC_*` (Firebase, Google OAuth) já estão cadastradas nos ambientes `preview` e `production` do EAS (não é o `.env` local — é o sistema de *Environment Variables* do próprio EAS, vinculado ao campo `"environment"` de cada profile no `eas.json`). Não é preciso reenviar a cada build; só atualize se algum valor mudar:

```bash
eas env:list --environment preview
eas env:create --environment preview   # ou eas env:update, pra alterar um valor existente
```

## Comportamento do mapa

- A malha municipal mínima é baixada da API oficial do IBGE, armazenada no cache local e renderizada como SVG.
- O mapa permite zoom por botões e navegação por arraste, sem usar Google Maps SDK.
- Ao tocar em um município, o app exibe nome, região e o campo `info`.
- A confirmação cria `users/{uid}/visits/{ibgeCode}`.
- Municípios visitados ficam verdes e o progresso aparece no topo.
- É possível remover uma marcação mediante nova confirmação.

## Validação local

```bash
cd mobile
pnpm typecheck
pnpm expo config --type public
```
