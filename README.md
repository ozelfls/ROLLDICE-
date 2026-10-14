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

O primeiro comando instala Electron, Three.js e as ferramentas de compilação. `npm start` compila a interface e abre a janela do aplicativo.

## Funcionalidades

- D4, D6, D8, D10, D12, D20, D100 e D% (10% a 100% em passos de dez).
- D20 tridimensional com vinte faces numeradas, animação de rolagem, quicadas e resultado visível até a próxima interação. Os demais dados mantêm a apresentação atual nesta etapa.
- D20, D100 e D%: 1 dado por rolagem. Para D20, vantagem e desvantagem fazem duas jogadas do mesmo dado e escolhem o maior ou menor resultado.
- D10 e D12: até 4 dados por rolagem.
- D4, D6 e D8: até 12 dados por rolagem.
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
npm run build
npm run smoke:desktop
```

Estrutura:

- `electron/main.cjs`: janela desktop e configuração de segurança.
- `src/engine.mjs`: regras de rolagem independentes da interface.
- `src/die-shapes.mjs`: geometria do D20.
- `src/dice-view.mjs`: renderização tridimensional do D20 com Three.js.
- `src/dice-motion.mjs`: trajetória e duração da animação.
- `src/app.mjs`: estado e interações da janela.
- `src/index.html` e `src/styles.css`: interface e estilos Tailwind.
- `test/engine.test.mjs`: testes das regras de rolagem.

O teste `smoke:desktop` abre temporariamente a janela Electron, verifica as interações principais e salva uma captura na pasta temporária do sistema.
