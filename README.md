# PetCare CRM

CRM de demonstração comercial para clínicas veterinárias e petshops: operação, agenda, prontuário simples, financeiro e uma área exclusiva para o tutor.

## O que a demonstração cobre

- Dashboard operacional com agenda, vacinas, cobranças e lembretes.
- Tutores com múltiplos pets.
- Vacinas, consultas, banho, tosa, exames, hotel e procedimentos.
- Agendamentos e observações clínicas simples.
- Pagamentos e lembretes.
- Gestão de usuários com papéis `admin`, `equipe` e `cliente`.
- Portal do cliente isolado por tutor.
- Dados fictícios prontos para uma apresentação comercial.

## Subir com Docker

Requisitos: Docker e Docker Compose.

As imagens usam o `package-lock.json` da raiz e `npm ci` por workspace; builds Docker e instalações locais resolvem exatamente as mesmas versões.

```bash
bash scripts/setup-env.sh
docker compose up --build -d
```

Abra [http://localhost:8080](http://localhost:8080).

| Serviço | Endereço |
| --- | --- |
| Web | `http://localhost:8080` |
| API pública | `http://localhost:8080/api` |
| Health | `http://localhost:8080/api/health` |
| API interna | `api:3000` |
| MySQL interno | `mysql:3306` |

## Credenciais de demonstração

| Perfil | Email | Senha |
| --- | --- | --- |
| Administrador | `admin@petcare.local` | `Demo123!` |
| Equipe | `equipe@petcare.local` | `Demo123!` |
| Cliente | `cliente@petcare.local` | `Demo123!` |

As credenciais são apenas para ambiente local. O script de setup gera segredos de infraestrutura aleatórios em `.env`; o MySQL e a API não publicam portas diretamente.

## Validação completa

No Linux/WSL:

```bash
bash scripts/validate.sh
```

No Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate.ps1
```

A validação compõe os serviços, constrói as imagens, aguarda os health checks e usa a API real para provar criação positiva, rejeição de relacionamentos incompatíveis, isolamento das listagens do cliente, autoria clínica, RBAC e sessão inválida.

## Desenvolvimento local

```bash
npm install
npm test
npm run build
```

O frontend usa `/api` em mesma origem no container web. Em desenvolvimento, o proxy do Vite aponta para `http://localhost:3000`.

## Limites conscientes desta versão

Esta versão é single-clinic e não inclui estoque, fornecedores, emissão fiscal, gateway de pagamento, telemedicina ou multi-tenancy. Esses módulos só devem entrar quando houver um caso comercial real para eles.

Leia também [arquitetura](docs/ARCHITECTURE.md), [API](docs/API.md), [migrações do banco](docs/DATABASE_MIGRATIONS.md), [segurança](docs/SECURITY.md) e [privacidade/LGPD](docs/PRIVACY_LGPD.md).

## Licença

[MIT](LICENSE).
