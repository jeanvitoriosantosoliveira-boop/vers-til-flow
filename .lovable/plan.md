## Plano de implementação — Versátil Digital v3

### 1. PeriodFilter — bug do range custom
- Em `src/components/PeriodFilter.tsx`: usar estado interno `range` controlado, mostrar `selected={{from,to}}` corretamente (passando mesmo quando só `from` está marcado), e atualizar `onChange` em qualquer mudança (não só quando `to` existe). Garantir destaque visual no range. Manter popover aberto até o usuário fechar.

### 2. Kanban — colunas dinâmicas (apenas líder)
- Novo tipo `KanbanColumn { id, title, accent, order }` em `types/index.ts`.
- Substituir `TaskStatus` enum fixo por `column_id: string` em `Task`. Manter retrocompatibilidade mapeando os 4 status atuais para colunas default (`todo`, `in_progress`, `review`, `done`).
- `AppStore`: adicionar `columns`, `createColumn`, `renameColumn`, `deleteColumn`, `reorderColumns`. Persistir em localStorage (ou Supabase quando configurado).
- `Kanban.tsx`: render dinâmico das colunas. Se `currentUser.role === 'leader'`: botão "+ Nova coluna" no fim da lista, e cada `Column` ganha menu (renomear/excluir) via dropdown no header.
- Atualizar `Column.tsx` para receber `title` editável e callbacks.

### 3. Relatórios — tela de detalhe
- Nova rota `/reports/:type` (clients | tasks | team | financial-summary).
- `src/pages/ReportDetail.tsx`: layout premium (cabeçalho com período, KPIs em cards, tabela detalhada, gráficos relevantes), botão "Baixar PDF" reutilizando `exportPdf.ts`.
- `Reports.tsx`: cards viram links navegáveis.

### 4. Clientes — esconder dados financeiros para funcionário
- Em `Clients.tsx` e `ClientDetail.tsx`: condicionar exibição de `monthly_fee`, lucro estimado, custos, ROI a `currentUser.role === 'leader'`. Para funcionário, mostrar só dados operacionais (tarefas, horas, status, satisfação opcional).

### 5. Equipe — cargo + perfil detalhado
- Adicionar `position` (gestor de tráfego, social media, designer, copywriter, dev, etc.) e `salary`, `tax_rate`, `hire_date` ao tipo `User`. Atualizar mocks.
- `Team.tsx`: card mostra avatar + nome + cargo (badge) + email.
- Nova rota `/team/:id` → `TeamMemberDetail.tsx` (somente líder vê salário/imposto):
  - últimas 10 tarefas lançadas
  - clientes atribuídos (via tarefas)
  - total de horas no período + gráfico
  - satisfação média dos clientes dele
  - área de "Anotações do líder" (notes salvas em store)
  - dados financeiros: salário, imposto extra (% configurável), custo total mensal
  - extras: produtividade (tarefas concluídas/mês), tempo médio por tarefa, taxa de conclusão no prazo

### 6. Financeiro (apenas líder) — nova tela `/finance`
- Tipos novos: `Expense { id, category, title, description, amount, date, recurring? }`, `ExtraService { id, client_id?, title, description, amount, date }`, `RecurringBill` (aluguel, luz, água, internet — categoria dentro de Expense com `recurring: monthly`).
- Store: arrays + CRUD persistidos em localStorage/Supabase.
- `Finance.tsx` com abas:
  - **Visão geral**: cards (Caixa atual, Entradas mês, Saídas mês, Lucro mês, Estimativa próximo mês baseada em mensalidades ativas + média de avulsos – despesas recorrentes – folha), gráfico comparativo dos últimos 6/12 meses, % crescimento vs mês anterior e mesmo mês ano anterior.
  - **Receitas**: mensalidades dos clientes ativos (somatório auto) + lançamento de serviços avulsos (form).
  - **Despesas**: lançamento de gastos pontuais e recorrentes (aluguel, luz, água, internet, equipamento), tabela filtrável por categoria.
  - **Folha**: lista da equipe com salário + imposto (calculado) → total mensal, com opção de ajustar % de imposto global.
  - **Relatório**: exportar PDF do período.
- Adicionar item "Financeiro" no `AppLayout` sidebar somente para líder.

### Detalhes técnicos
- Persistência mock: `localStorage` keys `vd:columns`, `vd:expenses`, `vd:extra_services`, `vd:team_notes`, `vd:tax_rate`.
- Estimativa próximo mês = Σ(`clients.active.monthly_fee`) + média(últimos 3 meses de avulsos) − Σ(despesas recorrentes) − Σ(folha com imposto).
- Caixa atual = saldo inicial configurável (default 0) + Σ entradas históricas − Σ saídas históricas.
- Atualizar `versatil_digital_schema.sql` com novas tabelas: `kanban_columns`, `expenses`, `extra_services`, `team_notes`, e colunas em `users` (`position`, `salary`, `tax_rate`, `hire_date`).
- `exportPdf.ts`: adicionar helper `exportFinancePdf` e generic `exportTablePdf`.
- Manter design bioluminescent (glass cards, glow, gradientes), tokens HSL existentes.

### Arquivos novos
- `src/pages/ReportDetail.tsx`
- `src/pages/TeamMemberDetail.tsx`
- `src/pages/Finance.tsx`
- `src/components/finance/ExpenseDialog.tsx`
- `src/components/finance/ExtraServiceDialog.tsx`
- `src/components/kanban/ColumnMenu.tsx`

### Arquivos editados
- `types/index.ts`, `data/mock.ts`, `store/AppStore.tsx`, `App.tsx`, `components/PeriodFilter.tsx`, `components/layout/AppLayout.tsx`, `components/kanban/Column.tsx`, `pages/Kanban.tsx`, `pages/Clients.tsx`, `pages/ClientDetail.tsx`, `pages/Team.tsx`, `pages/Reports.tsx`, `lib/exportPdf.ts`, `versatil_digital_schema.sql`.
