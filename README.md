# Dado RPG Desktop

Rolador de dados de RPG em uma janela de desktop, feito com JavaScript, Electron e Tailwind CSS. Funciona localmente, sem servidor ou conexão com a internet durante o uso.

## Requisitos

- Node.js 20.19 ou superior
- npm

## Executar

```sh
npm install
npm start
```

O primeiro comando instala Electron e a ferramenta de compilação do Tailwind. `npm start` compila o CSS e abre a janela do aplicativo.

## Funcionalidades

- D4, D6, D8, D10, D12, D20, D100 e D% (10% a 100% em passos de dez).
- De 1 a 8 dados por rolagem.
- Modificador de −100 a +100.
- Modos normal, vantagem (maior de dois) e desvantagem (menor de dois).
- Rerrolagem rápida com desvantagem, mantendo dado, quantidade e modificador da última jogada feita pelo botão Rolar.
- Sucesso e falha críticos em um único D20.
- Soma de múltiplos D6 antes de aplicar o modificador; os demais dados mostram seus resultados individualmente.
- Histórico recolhível da sessão, limpeza do histórico, reset do resultado e tema claro/escuro.

O histórico existe somente enquanto a janela está aberta, como no rolador original. A seção de fichas foi removida. Se houver um arquivo `character_data.json` antigo, ele não é usado pelo aplicativo novo.

## Desenvolvimento

```sh
npm test
npm run build:css
npm run smoke:desktop
```

Estrutura:

- `electron/main.cjs`: janela desktop e configuração de segurança.
- `src/engine.mjs`: regras de rolagem independentes da interface.
- `src/app.mjs`: estado e interações da janela.
- `src/index.html` e `src/styles.css`: interface e estilos Tailwind.
- `test/engine.test.mjs`: testes das regras de rolagem.

O teste `smoke:desktop` abre temporariamente a janela Electron, verifica as interações principais e salva uma captura na pasta temporária do sistema.
