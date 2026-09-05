# OBR 2026 — Simulador de Treinamento de Juízes (Resgate) v1.0

## Como executar
```bash
python3 -m http.server 8080
```
Abra: http://localhost:8080

## O que mudou na v1.0 (remake de interface)

- Novo sistema visual padronizado ("console de arbitragem") aplicado às 5 telas: Editor de arena, Simulação, Controle manual, Construtor de ladrilho, Construtor de objeto.
- Navegação por abas numeradas (1 a 5), refletindo o fluxo de uso recomendado.
- Guia rápido: botão "?" no topo abre um painel com passo a passo e atalhos — não existia nenhuma instrução na v0.5.
- Ladrilhos personalizados (criados no Construtor de ladrilho) agora aparecem juntos com os ladrilhos padrão na mesma paleta do Editor de arena, em vez de uma lista separada.
- Passar o mouse sobre qualquer ladrilho da paleta (padrão ou personalizado) mostra um preview ampliado antes de clicar.
- Excluir um ladrilho personalizado agora é feito direto na paleta (ícone ✕), sem precisar abrir outro painel.

## O que NÃO mudou (por design)

O motor de simulação e pontuação (regras OBR, física do robô, sistema de undo/redo, construtores em pixel 3×3, import/export JSON) foi mantido como está — é a parte que já funcionava corretamente e mexer nela sem poder testar em navegador traria risco desnecessário de quebrar algo. O trabalho desta versão foi 100% na camada de interface/experiência.

## Estrutura
```
/
├── index.html
├── css/style.css
└── js/
    ├── main.js
    └── engine/
        ├── Models.js
        └── ScoreEngine.js
```
