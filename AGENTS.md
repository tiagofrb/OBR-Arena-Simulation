# AGENTS.md — diretrizes de código e documentação (OBR-Arena-Simulation)

Extraído de `boas-praticas-opensource-llm.md` (que por sua vez veio do
artigo do Akita), filtrando apenas o que é diretriz de **como o código deve
ser escrito, estruturado e documentado** por uma LLM trabalhando no projeto.
Pensado para virar um arquivo de instruções persistentes (ex.: `AGENTS.md`,
`CLAUDE.md` ou seção de `CONTRIBUTING.md`) para o OBR-Arena-Simulation.

## Ao gerar ou alterar código

- **Não deixar código morto.** Ao terminar uma tarefa, revisar se sobrou
  função, variável, import ou arquivo sem uso e remover.
- **Não duplicar lógica desnecessariamente.** Se a mesma lógica aparece em
  dois lugares, extrair para uma função/módulo compartilhado em vez de
  copiar e colar.
- **Não usar valores mágicos hardcoded.** Números, strings ou configurações
  que carregam significado (ex.: tamanho de grid, tempo limite, cor de
  status) devem virar **constantes nomeadas**, e essas constantes devem
  estar documentadas (o que representam, por que esse valor).
- **Seguir princípios de clean code de forma consistente**: nomes claros,
  funções pequenas e com responsabilidade única, evitar aninhamento
  excessivo — o mesmo padrão de qualidade em toda alteração, não só nas
  partes "importantes".
- **Garantir cobertura de testes adequada para o que foi alterado.** Toda
  mudança de comportamento deve vir acompanhada de teste que comprove esse
  comportamento (ou atualização do teste existente que ficou desatualizado).
- **Atualizar a documentação junto com o código na mesma alteração.**
  Nunca tratar documentação como tarefa separada/posterior — se uma mudança
  de código torna uma frase do README, de um `docs/` ou de um comentário
  desatualizada, corrigir isso faz parte da própria tarefa.

## Ao revisar código (auditoria de PR / sessão de mudanças)

Instruções derivadas dos dois prompts de revisão citados no artigo original —
úteis tanto para o Claude revisar seu próprio trabalho quanto para revisar
mudanças de terceiros:

- **Não confiar apenas na descrição da mudança.** Ler o código de fato
  alterado, não só o resumo de quem propôs a mudança — a descrição pode não
  bater com o que foi realmente implementado.
- **Checar explicitamente, em qualquer revisão:**
  - Regressões ou queda de qualidade em relação ao que já existia
  - Cobertura de testes adequada para o que mudou
  - Código morto introduzido ou deixado para trás
  - Duplicação desnecessária
  - Valores mágicos sem constante/documentação
  - Se a documentação foi atualizada junto
- **Depois de várias mudanças acumuladas** (não só um PR isolado), fazer uma
  passada mais ampla procurando os mesmos pontos acima no conjunto do que foi
  alterado, não só no último commit.
- **Apresentar o diagnóstico, não decidir sozinho** quando a revisão for
  para apoiar uma decisão humana: relatar o que foi encontrado e recomendar
  um caminho, deixando a decisão final (mergear, corrigir, recusar) para a
  pessoa responsável pelo projeto.

## Estrutura de documentação do projeto

- **README enxuto e focado no problema/uso**, não em detalhes de
  implementação — quem lê o README quer saber o que a ferramenta resolve e
  como usar, não a arquitetura interna.
- **Detalhe técnico e decisões de arquitetura vão num diretório separado**
  (ex. `docs/`), não no topo do README — conteúdo voltado a quem for mexer
  no código, separado do conteúdo voltado a quem só quer usar.
- **Manter um `CHANGELOG.md` por versão**, atualizado a cada mudança
  relevante, com uma seção por versão — nunca deixar a LLM "lembrar depois";
  o changelog é atualizado como parte da própria tarefa que gerou a mudança.
- **Documentação deve ser honesta sobre limitações conhecidas** em vez de
  omitir problemas — inclusive dentro de comentários de código, para não
  deixar armadilhas escondidas para quem ler depois.

## Resumo operacional (checklist rápido para toda tarefa de código)

- [ ] Removi código morto que ficou sem uso?
- [ ] Evitei duplicar lógica já existente em outro lugar do projeto?
- [ ] Todo valor mágico virou constante nomeada e documentada?
- [ ] Escrevi/atualizei teste cobrindo o comportamento alterado?
- [ ] Atualizei README/`docs/`/comentários afetados por esta mudança?
- [ ] Atualizei o `CHANGELOG.md` se a mudança for relevante para quem usa o projeto?
