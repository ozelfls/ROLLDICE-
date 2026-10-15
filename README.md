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

- D4, D6, D8, D10, D12, D20, D100 e D% (10% a 90% em passos de dez; a face 00 é decorativa).
- Todos os dados têm modelos tridimensionais com faces numeradas e resultado visível até a próxima interação. Eles atravessam o painel com trajetórias variáveis, gravidade, quicadas e colisões, parando na posição em que terminaram a rolagem. As faces numeradas passam pelo campo de visão com um borrão de velocidade que desaparece gradualmente; a rotação inteira já conduz à face sorteada, sem correção final separada.
- D20, D100 e D%: 1 dado por rolagem. Para D20, vantagem e desvantagem fazem duas jogadas do mesmo dado e escolhem o maior ou menor resultado.
- D10 e D12: até 4 dados por rolagem.
- D4, D6 e D8: até 12 dados por rolagem.
- Modificador de −100 a +100 e até quatro bônus extras entre −100 e +100, aplicados um por vez depois da revelação do dado.
- CD opcional entre 1 e 999, com indicação de sucesso ou falha depois do cálculo; 1 e 20 naturais do D20 prevalecem sobre a CD.
- Segundo clique em Rolar pula a animação e mostra o resultado final.
- Modos normal, vantagem (maior de dois) e desvantagem (menor de dois).
- Rerrolagem rápida com desvantagem, mantendo dado, quantidade, modificador, bônus e CD da última jogada feita pelo botão Rolar.
- Sucesso e falha críticos em um único D20.
- Soma de todos os dados selecionados antes de aplicar o modificador uma única vez, com valores individuais, subtotal e total.
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
- `src/die-shapes.mjs`: geometria dos oito tipos de dado.
- `src/dice-view.mjs`: renderização tridimensional com Three.js.
- `src/dice-motion.mjs`: trajetória e duração da animação.
- `src/app.mjs`: estado e interações da janela.
- `src/index.html` e `src/styles.css`: interface e estilos Tailwind.
- `test/engine.test.mjs`: testes das regras de rolagem.

O teste `smoke:desktop` abre temporariamente a janela Electron, verifica as interações principais e salva uma captura na pasta temporária do sistema.
