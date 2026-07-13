# Prontidão comercial e evolução para produção

Avaliação consolidada em 13 de julho de 2026, baseada no contrato do produto, no grafo do repositório, no código da API e da interface, no histórico Git e nas validações automatizadas e visuais.

## Veredito

O PetCare CRM está **pronto para demonstração comercial com dados fictícios**: sobe com um comando, apresenta uma interface responsiva, cobre a operação principal de uma clínica e possui isolamento autenticado do tutor.

Ele **ainda não deve receber dados pessoais ou clínicos reais em produção**. Antes disso, são obrigatórios os itens P0 abaixo, especialmente auditoria, exercício dos direitos LGPD, gestão segura de contas, TLS, backup/restore e observabilidade.

Essa separação é intencional. Estoque, emissão fiscal, gateway de pagamento, telemedicina e multi-tenancy continuam fora do escopo até existir demanda comercial comprovada.

## Evidências já aprovadas

| Capacidade | Estado atual | Evidência |
| --- | --- | --- |
| Autenticação e autorização | Implementada | Cookie HttpOnly, login limitado, RBAC na API e consultas do tutor filtradas por `customer_id`. |
| Operação clínica/comercial | Implementada | Tutores, pets, vacinas, serviços, agenda, prontuário, pagamentos, lembretes, usuários, dashboard e portal. |
| Integridade relacional | Implementada | Relações pet/tutor, consulta/pet/tutor e vínculos clínicos/financeiros reforçados na API e no banco. |
| Datas e financeiro | Implementada | Política de horário local da clínica e invariância entre `status` e `paid_date`. |
| Experiência comercial | Implementada | Interface desktop e móvel, dados fictícios apresentáveis e autoria clínica real no portal. |
| Entrega reproduzível | Implementada | `npm ci` com lockfile raiz, imagens Docker, health checks, smoke autenticado e validação limpa. |
| Paginação e pesquisa | Ausente | Endpoints retornam `{ items }` e aplicam `LIMIT 200`, sem total, página, busca, filtros ou ordenação solicitada. |
| Edição geral | Parcial | Cadastros são criados e três recursos permitem trocar status; não há edição dos demais campos. |
| Auditoria | Ausente | Não existe trilha imutável de quem alterou qual registro, antes/depois e quando. |
| Direitos LGPD | Documentado, não operacional | A política reconhece exportação/correção/eliminação, mas a API não oferece esses fluxos. |

## P0 — obrigatório antes de produção real

### 1. Auditoria antes da edição

Criar uma tabela append-only `audit_events` com ator, ação, tipo/id do registro, instante, valores anteriores e posteriores e identificador da requisição. Endereço IP só deve ser persistido quando houver finalidade e retenção documentadas.

Critérios de aceite:

- toda criação, edição, mudança de status, desativação e exportação LGPD gera evento;
- usuários operacionais não conseguem alterar ou excluir eventos;
- testes provam autoria, conteúdo antes/depois e isolamento de acesso;
- falha ao gravar auditoria interrompe a mutação, na mesma transação.

### 2. Fluxos LGPD autenticados

Entregar exportação estruturada do tutor e de todos os registros vinculados, correção controlada e solicitação de anonimização/eliminação compatível com a retenção clínica e financeira definida pela clínica. Para o volume atual, uma resposta síncrona em JSON e CSV é suficiente; fila e armazenamento de arquivos só entram se medições reais exigirem.

Critérios de aceite:

- tutor só exporta os próprios dados; admin exporta mediante permissão e motivo auditado;
- o pacote inclui perfil, pets, serviços, agenda, prontuário, pagamentos e lembretes;
- campos técnicos e segredos nunca entram no pacote;
- correção e eliminação preservam os registros cuja retenção for obrigatória;
- smoke cobre exportação própria e tentativa de exportar outro tutor.

### 3. Contas e implantação segura

- remover atalhos e senhas de demonstração da imagem destinada à produção;
- implementar convite/definição de senha, recuperação, revogação de sessões e desativação de acesso;
- publicar somente atrás de TLS, com `COOKIE_SECURE=true` e segredos fortes fora do repositório;
- definir backup, restauração testada, retenção, recuperação de desastre e resposta a incidente;
- adicionar logs estruturados, correlação de requisições, métricas, alertas e varredura de dependências/imagens;
- avaliar proteção CSRF explícita para as mutações autenticadas por cookie no ambiente publicado.

## P1 — próximo ciclo comercial

### Paginação, pesquisa, filtros e ordenação

Substituir o corte silencioso por um contrato pequeno e consistente:

```text
GET /api/pets?page=1&page_size=25&q=luna&sort=name&order=asc
{
  "items": [],
  "page": 1,
  "page_size": 25,
  "total": 0
}
```

Regras:

- `page >= 1`, `1 <= page_size <= 100` e padrão 25;
- `q` pesquisa apenas colunas previamente permitidas para cada recurso;
- `sort` e `order` usam allow-list, nunca nomes SQL recebidos livremente;
- filtros respeitam o mesmo escopo de autorização da listagem;
- a interface mostra pesquisa com atraso curto, filtros úteis, total e navegação de páginas;
- o portal agrega apenas dados necessários e pagina históricos potencialmente longos.

### Edição segura

Adicionar `PATCH /api/<recurso>/:id` por recurso, reutilizando as validações de criação, com allow-list de campos e transação quando houver relações. Usar `updated_at` como controle de concorrência: uma edição baseada em versão antiga retorna `409` em vez de sobrescrever silenciosamente.

Ordem recomendada: auditoria; tutores e pets; agenda e serviços; vacinas e lembretes; financeiro; prontuário clínico com política mais restritiva. Exclusão física não deve ser a operação padrão; desativação e retenção explícita preservam histórico.

### Relatórios e exportações operacionais

Depois de paginação/pesquisa, oferecer CSV das listagens filtradas, agenda por período, pagamentos por status e vacinas a vencer. A exportação operacional não substitui a exportação LGPD e deve possuir autorização e auditoria próprias.

## Erros e riscos adicionais encontrados

1. `LIMIT 200` faz registros antigos desaparecerem sem indicar que há mais resultados.
2. Erros de integridade do MySQL diferentes de e-mail duplicado chegam como `500` genérico; conflitos conhecidos devem virar respostas `409` seguras e testadas.
3. O portal retorna coleções completas e pode degradar conforme o histórico clínico cresce.
4. Não há desativação operacional de tutor/pet/usuário, apesar dos campos `active` existentes.
5. O modal precisa de fechamento por `Escape`, foco inicial, contenção de foco e restauração do foco para acessibilidade completa.
6. A aplicação não possui recuperação de senha, expiração global/revogação de sessões ou segundo fator para administradores.
7. Health check prova disponibilidade, mas ainda não há telemetria para latência, erros, capacidade e incidentes.

## Sequência de entrega recomendada

1. Fundação de produção: auditoria, contas seguras, TLS, backup/restore, observabilidade e runbook de incidentes.
2. Paginação e pesquisa na API, depois componentes reutilizáveis na interface.
3. Edição com concorrência otimista, iniciando por tutores e pets.
4. Exportação/correção/eliminação LGPD com auditoria e testes de isolamento.
5. Relatórios/CSV baseados nos mesmos filtros e permissões.
6. Somente então avaliar integrações ou módulos novos a partir de uso, vendas e suporte reais.

Cada etapa deve manter os gates existentes: testes unitários, build de produção, imagens pelo lockfile, banco limpo, health checks e smoke autenticado com isolamento entre tutores.
