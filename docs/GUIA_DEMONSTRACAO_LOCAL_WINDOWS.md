# Guia de instalação e demonstração local — Windows (PC do zero)

> **Escopo:** demonstração comercial local do PetCare CRM, usando **Windows 10/11 + Ubuntu no WSL 2 + Docker Desktop (contêineres Linux)**. Este roteiro foi conferido contra os arquivos da branch `main`: `docker-compose.yml`, Dockerfiles, scripts, SQL, frontend e API. Não é uma validação feita em um PC recém-instalado. **Não utilizar dados pessoais ou clínicos reais.**

## 0. Visão rápida: o que será instalado

O sistema é composto por três contêineres, todos administrados pelo Docker Compose:

| Serviço | Tecnologia | Função | Porta |
| --- | --- | --- | --- |
| `web` | React/Vite compilado e servido por Nginx | Interface e proxy HTTP da API | **8080** no Windows, por padrão |
| `api` | Node.js 22 + Express | Autenticação, validação e operações de negócio | `3000` **somente dentro do Docker** |
| `mysql` | MySQL 8.4 | Dados e carga fictícia inicial | `3306` **somente dentro do Docker** |

O navegador acessa `http://localhost:8080`. O Nginx encaminha `/api/` para a API, e a API se conecta ao MySQL pela rede interna dos contêineres. **Não** é preciso instalar MySQL ou Node.js diretamente no Windows para apenas apresentar a demo.

### Pré-requisitos práticos

- Windows 10/11 de 64 bits com versão suportada pelo Docker Desktop; prefira Windows 11 atualizado. Consulte os requisitos oficiais antes de instalar: [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
- Processador com virtualização habilitada no BIOS/UEFI; confira **Gerenciador de Tarefas > Desempenho > CPU > Virtualização: Habilitada**.
- **8 GB de RAM como mínimo de referência do Docker Desktop; 16 GB recomendados** para trabalhar com folga. Reserve, como estimativa prática, **20 GB ou mais** de espaço livre para Windows/WSL, imagens e banco.
- Conexão com a internet na primeira instalação para baixar Ubuntu, Docker, código e imagens; depois de instalados, os serviços rodam localmente.
- Permissão para instalar programas no Windows. Nenhuma chave de API ou serviço SaaS é necessária.

**Atenção aos terminais:** os blocos marcados **PowerShell** rodam no Windows; os marcados **Ubuntu/WSL** rodam dentro do Ubuntu. Não cole comandos Bash no PowerShell nem comandos `wsl --install` no Ubuntu.

## 1. Preparar o Windows e instalar Ubuntu/WSL 2

**Terminal: PowerShell como Administrador** (botão direito no menu Iniciar > Terminal/PowerShell (Admin)).

1. Verifique a virtualização no Gerenciador de Tarefas. Se estiver desabilitada, habilite Intel VT-x/AMD-V/SVM no BIOS/UEFI conforme o fabricante e reinicie.
2. Instale o Ubuntu no WSL e atualize o WSL:

```powershell
wsl --install -d Ubuntu
```

3. **Reinicie o Windows se solicitado.** Abra novamente o PowerShell e execute:

```powershell
wsl --update
wsl --list --verbose
```

4. O Ubuntu deve aparecer com **VERSION 2**. Se aparecer versão 1, execute:

```powershell
wsl --set-version Ubuntu 2
```

5. Abra **Ubuntu** pelo menu Iniciar ou execute `wsl -d Ubuntu` no PowerShell. Na primeira inicialização, escolha um usuário e uma senha Linux. **Ao digitar a senha no terminal Linux, os caracteres não aparecem: isso é normal.**

**Critério de conclusão:** o Ubuntu abre e `wsl --list --verbose` mostra `Ubuntu` na versão `2`.

Referência: [instruções oficiais do WSL](https://learn.microsoft.com/pt-br/windows/wsl/install).

## 2. Instalar e preparar o Docker Desktop

**No Windows:**

1. Instale pelo [site oficial do Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) ou pelo PowerShell com `winget`:

```powershell
winget install --id Docker.DockerDesktop -e
```

2. Abra o **Docker Desktop** pelo menu Iniciar e conclua a configuração inicial.
3. Confirme que está usando **Linux containers** e o mecanismo **WSL 2** (em versões que exibem a opção: `Settings > General > Use WSL 2 based engine`).
4. Em `Settings > Resources > WSL Integration`, habilite a integração com **Ubuntu** e clique em **Apply & Restart**. Os nomes das telas podem variar por versão.
5. Aguarde o Docker Desktop indicar que seu mecanismo está ativo.

**Terminal: Ubuntu/WSL**, execute:

```bash
docker version
docker compose version
docker info --format '{{.ServerVersion}}'
```

**Critério de conclusão:** os três comandos terminam sem erro; `docker version` mostra também a seção `Server`. **Não instale um segundo Docker Engine dentro do Ubuntu:** use o mecanismo oferecido pelo Docker Desktop.

Se `docker: command not found` aparecer no Ubuntu, volte ao Docker Desktop e habilite `WSL Integration` para essa distribuição. Se aparecer `Cannot connect to the Docker daemon`, inicie o Docker Desktop e confira que está usando contêineres Linux.

Referência: [integração oficial Docker + WSL 2](https://docs.docker.com/desktop/features/wsl/use-wsl/).

## 3. Preparar o Ubuntu e baixar a branch `main`

**Terminal: Ubuntu/WSL**. Instale as ferramentas necessárias para clonar o código e gerar as senhas da demo:

```bash
sudo apt update
sudo apt install -y git openssl curl ca-certificates
git --version
openssl version
```

Armazene o projeto **dentro do sistema de arquivos do Linux**, por exemplo em `~/petcare-crm`, evitando cloná-lo em `/mnt/c` para não introduzir problemas de permissões e desempenho de volumes.

```bash
cd ~
git clone --branch main --single-branch https://github.com/millennium42/petcare-crm.git
cd ~/petcare-crm
git status --short --branch
ls -la
```

**Critério de conclusão:** o `git status` mostra `main` sem alterações locais e o diretório contém `docker-compose.yml`, `database/`, `api/`, `web/` e `scripts/`.

Se a pasta já existir, **não clone por cima**: use `cd ~/petcare-crm` e siga a seção **Atualizar uma demo existente**.

## 4. Gerar as configurações e segredos locais

**Terminal: Ubuntu/WSL**, na raiz do projeto:

```bash
cd ~/petcare-crm
bash scripts/setup-env.sh
test -s .env && echo "Arquivo .env criado"
grep -E '^(MYSQL_DATABASE|MYSQL_USER|WEB_PORT|COOKIE_SECURE)=' .env
```

O script usa `openssl` para criar senhas aleatórias de MySQL e a chave JWT. Também define, por padrão:

- `MYSQL_DATABASE=petcare`
- `MYSQL_USER=petcare`
- `WEB_PORT=8080`
- `COOKIE_SECURE=false` (somente porque esta é uma **demo HTTP local**, sem TLS)

**Nunca publique o arquivo `.env` ou suas senhas no GitHub, em capturas de tela ou na documentação.** O script **não substitui** um `.env` existente; preserve-o junto com o volume do banco, mesmo após reiniciar ou atualizar o sistema.

Confira a configuração sem revelar senhas:

```bash
docker compose config --quiet
```

**Critério de conclusão:** `docker compose config --quiet` termina sem mensagem de erro.

## 5. Construir e iniciar os três serviços

**Terminal: Ubuntu/WSL**, com o Docker Desktop aberto:

```bash
cd ~/petcare-crm
docker compose up --build --wait --wait-timeout 600
```

O Compose fará o download da imagem MySQL, compilará as imagens da API e da interface e iniciará os serviços em ordem: banco saudável → API saudável → interface saudável.

O `--wait` só conclui quando todos os serviços estiverem executando/saudáveis; `600` segundos é um limite de tolerância para uma máquina lenta, **não uma previsão de duração**.

Confira o estado:

```bash
docker compose ps
```

**Critério de conclusão:** os serviços `mysql`, `api` e `web` aparecem com status `Up` / `healthy` e o `web` publica a porta `8080`.

Se um deles falhar:

```bash
docker compose ps --all
docker compose logs --tail=120 mysql
docker compose logs --tail=120 api
docker compose logs --tail=120 web
```

**Importante:** ao iniciar o MySQL **pela primeira vez em um volume novo**, os arquivos de `database/` são executados na ordem `001_schema.sql`, `002_seed.sql` e `003_compound_relationships.sql`. Eles criam as tabelas, dados fictícios e relações adicionais. Em um volume já existente, esses scripts **não executam novamente automaticamente**.

## 6. Verificar se a aplicação realmente está pronta

**Terminal: Ubuntu/WSL**:

```bash
curl -fsS http://localhost:8080/api/health
bash scripts/check-seed.sh
bash scripts/check-relations.sh
```

Saídas esperadas:

- O endpoint de saúde devolve JSON contendo `"status":"ok"`.
- O `check-seed.sh` confirma hashes bcrypt, **3 usuários, 3 pets e 6 serviços** do banco inicial.
- O `check-relations.sh` confirma chaves estrangeiras compostas e rejeição de vínculos inválidos.

**No navegador do Windows**, abra:

**http://localhost:8080**

Não tente abrir `web/index.html` como um arquivo local: a interface depende da API por `/api`.

### Contas fictícias de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@petcare.local` | `Demo123!` |
| Equipe | `equipe@petcare.local` | `Demo123!` |
| Tutor/cliente | `cliente@petcare.local` | `Demo123!` |

Não reutilize essas credenciais em ambientes reais.

## 7. Roteiro de apresentação ao cliente (15–20 minutos, orientativo)

**Parte A — Administração:** entre como `admin@petcare.local`. Mostre a visão geral e os indicadores, abra `Clientes` e `Pets` para explicar a relação tutor–animais. Mostre `Vacinas`, `Serviços` e `Agenda`; navegue por `Prontuário`, `Pagamentos` e `Lembretes`. Em `Usuários`, mostre a separação entre administrador, equipe e tutor.

**Parte B — Operação:** saia da conta e entre como `equipe@petcare.local`. Cadastre um tutor fictício, associe um pet a esse tutor e crie um agendamento. Confirme que a seleção de pets depende do tutor escolhido. Registre uma observação clínica simples, um pagamento ou um lembrete. Demonstre a mudança de status de um agendamento, pagamento ou lembrete.

**Parte C — Portal do tutor:** encerre a sessão e entre como `cliente@petcare.local`; se preferir comparação simultânea, utilize janela anônima. Mostre somente os pets e registros pertencentes àquela conta, sem acesso às funções administrativas. Os dados criados para outro tutor **não** aparecem automaticamente no portal do usuário fictício existente.

**Encerramento:** explique o que é demonstrável hoje e a diferença entre **demo comercial** e **sistema apto a dados reais**. A versão atual **não possui** controle de estoque, NF-e, gateway de pagamento, recuperação de senha, edição geral de cadastros ou trilha completa de auditoria; pagamentos são registros internos, não transações processadas.

> **Nota de UX:** o projeto permite criação de vários tipos de cadastro e alteração de status em três áreas. Não prometa edição ou exclusão completa de todos os registros, pois essas operações ainda não estão implementadas.

## 8. Rodar a validação completa (opcional, recomendado antes de apresentar)

**Para apenas usar a demo, pule esta seção.** O sistema já contém Node.js dentro da imagem da API e não precisa de uma instalação local do Node.

Para executar `npm ci`, testes unitários, build, checagens de UI e `scripts/smoke.mjs` no **Ubuntu/WSL**, instale o **Node.js 22** no Ubuntu (não basta instalá-lo no Windows).

Uma opção é usar o `nvm` oficial; no **Ubuntu**:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
node --version
npm --version
```

O comando `node --version` deve mostrar `v22.*`. Caso o instalador do `nvm` seja atualizado, consulte [nvm-sh/nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

Então, na raiz do projeto:

```bash
cd ~/petcare-crm
npm ci --no-audit --no-fund
npm test
npm run check --workspace petcare-web
bash scripts/validate.sh
```

O `validate.sh` também valida o Compose, reconstrói/inicia os serviços, aguarda os health checks e executa os testes do seed, dos relacionamentos e o **smoke test autenticado** da API. O smoke pode **criar registros fictícios de teste** no banco; não rode esse procedimento em um banco com dados que você não queira alterar.

**Critério de conclusão:** os comandos encerram com código de saída `0`, a mensagem `UI check OK` aparece e o smoke relata que passou. Guarde o log do terminal como evidência local. **Não considere esta etapa aprovada até executá-la na máquina usada para a apresentação.**

O arquivo `scripts/validate.ps1` pressupõe uma distribuição WSL chamada `Ubuntu` e converte um caminho **do Windows** para o Linux. **Neste roteiro, como o clone está em `~/petcare-crm` no Ubuntu, execute `bash scripts/validate.sh` diretamente no Ubuntu**, não o wrapper PowerShell.

## 9. Como parar, retomar e atualizar

**Parar preservando o banco:**

```bash
cd ~/petcare-crm
docker compose stop
```

**Retomar a mesma demo (abra o Docker Desktop primeiro):**

```bash
cd ~/petcare-crm
docker compose start --wait --wait-timeout 600
curl -fsS http://localhost:8080/api/health
```

**Desligar os contêineres sem apagar dados:**

```bash
docker compose down
```

Para voltar de `down`:

```bash
docker compose up --wait --wait-timeout 600
```

**Atualizar código da `main` sem apagar o volume:**

```bash
cd ~/petcare-crm
git status --short --branch
git pull --ff-only origin main
docker compose up --build --wait --wait-timeout 600
```

Antes de atualizar um banco que **já existia antes da migração `003_compound_relationships.sql`**, siga `docs/DATABASE_MIGRATIONS.md`: novos arquivos SQL de inicialização **não são migrações automáticas para volumes existentes**. Faça backup e aplique a migração conforme o procedimento específico.

### Backup simples da demonstração

**Terminal: Ubuntu/WSL**, com MySQL ativo:

```bash
cd ~/petcare-crm
mkdir -p "$HOME/petcare-backups"
docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > "$HOME/petcare-backups/petcare-$(date +%Y%m%d-%H%M%S).sql"
ls -lh "$HOME/petcare-backups"/
```

Os arquivos em `~/petcare-backups/` podem conter dados pessoais caso o banco seja reutilizado indevidamente; proteja-os e **não os envie ao repositório Git**.

**AVISO — apaga os registros do banco:** `docker compose down -v` remove o volume `mysql_data`. Só use para uma **demo descartável**, quando tiver certeza de que não precisa dos dados. No próximo `up`, os dados fictícios serão recriados pelos scripts SQL.

## 10. Diagnóstico de erros mais prováveis

| Sintoma | Causa provável | Correção objetiva |
| --- | --- | --- |
| `wsl --install` falha | Windows antigo, virtualização desativada ou falta de privilégio | Atualize Windows, execute como administrador, habilite virtualização; veja a documentação da Microsoft |
| `docker: command not found` no Ubuntu | Docker Desktop sem integração WSL | Habilite Ubuntu em `Settings > Resources > WSL Integration` e reinicie o terminal |
| `Cannot connect to the Docker daemon` | Docker Desktop fechado/não iniciado | Abra o Docker Desktop e confirme o mecanismo Linux |
| `Bind for 0.0.0.0:8080 failed` ou porta já em uso | Outra aplicação ocupa a porta | Identifique com `Get-NetTCPConnection -LocalPort 8080` **no PowerShell**; ou troque `WEB_PORT=8080` por `WEB_PORT=8081` no `.env` e use `http://localhost:8081` |
| Interface não abre ou API dá 502 | Banco/API ainda inicializando ou contêiner falhou | `docker compose ps` e `docker compose logs --tail=120 api`; execute `docker compose up --build --wait --wait-timeout 600` |
| `check-seed.sh` falha com quantidades diferentes | Volume antigo, dados já modificados ou seed incompleto | Confira `docker compose logs mysql` e o volume; não apague dados sem backup |
| `check-relations.sh` falha | Banco antigo ainda sem a migração 003 | Leia `docs/DATABASE_MIGRATIONS.md` antes de modificar o banco |
| Login retorna erro | Credenciais erradas ou seed indisponível | Confira as três contas acima, `/api/health` e `check-seed.sh` |
| `npm: command not found` | Node 22 não instalado no Ubuntu | Siga a seção 8; não é necessário para apenas apresentar a demo |
| `npm ci` falha | Falta rede, Node incorreto ou pacote corrompido | Confirme `node --version`, internet e o `package-lock.json`; nunca use `npm install` para mascarar problema de reprodutibilidade |
| Mudou `.env` e banco não conecta | Senhas do volume persistente não coincidem com as novas | Restaure o `.env` original, não destrua o volume sem backup |
| Falha após `git pull` em base antiga | Inicialização SQL não aplica migrations retroativamente | Faça backup e siga `docs/DATABASE_MIGRATIONS.md` |

Para coletar um diagnóstico único:

```bash
cd ~/petcare-crm
docker compose config --quiet
docker compose ps --all
docker compose logs --tail=150
curl -i http://localhost:8080/api/health
```

**Não compartilhe `.env`, senhas nem logs contendo dados sensíveis em canais públicos.**

## 11. Segurança da demo e limites de rede

- O uso indicado é **um PC local com dados fictícios**, acessado por `localhost`. A porta `8080` está publicada no Windows pelo Compose e, conforme o firewall e a rede, **também poderá ser alcançável de outro equipamento**. Evite redes públicas e não abra portas no roteador.
- Para restringir explicitamente o servidor ao próprio computador, altere **apenas a porta do serviço `web`** em `docker-compose.yml`, de `"${WEB_PORT:-8080}:80"` para `"127.0.0.1:${WEB_PORT:-8080}:80"`, então execute `docker compose up -d`. Isso é um ajuste local opcional; não é necessário quando o acesso já está isolado pela política de firewall/rede.
- O cookie da demo usa `COOKIE_SECURE=false` por ser HTTP local. **Não** publique essa instância na internet e não substitua uma implantação de produção por um port-forward.
- O sistema não está aprovado para uso com prontuários reais ou outros dados pessoais sem medidas adicionais de proteção, backup/restauração, auditoria e fluxos LGPD.

## 12. Checklist final antes de apresentar

- [ ] Windows atualizado, virtualização habilitada e Ubuntu no WSL 2.
- [ ] Docker Desktop com Linux containers e integração Ubuntu ativa.
- [ ] Repositório da `main` clonado em `~/petcare-crm`.
- [ ] `.env` gerado pelo script sem divulgar os segredos.
- [ ] `docker compose ps` mostra `web`, `api` e `mysql` saudáveis.
- [ ] `http://localhost:8080/api/health` responde `status: ok`.
- [ ] `scripts/check-seed.sh` e `scripts/check-relations.sh` passaram.
- [ ] Login administrador, equipe e tutor testados no navegador.
- [ ] Fluxo tutor → pet → agendamento testado.
- [ ] Portal do tutor exibe apenas os seus próprios registros.
- [ ] Testes completos da seção 8 executados, caso se deseje evidência técnica adicional.
- [ ] Nenhum dado pessoal/real inserido; rede e firewall conferidos.

### Fontes e arquivos auditados

**Neste repositório:** [docker-compose.yml](../docker-compose.yml), [Dockerfile da API](../api/Dockerfile), [Dockerfile do web](../web/Dockerfile), [setup-env.sh](../scripts/setup-env.sh), [validate.sh](../scripts/validate.sh), [smoke.mjs](../scripts/smoke.mjs), [scripts do banco](../database/), [migrações](DATABASE_MIGRATIONS.md), [prontidão comercial](COMMERCIAL_READINESS.md), [roteiro rápido](DEMO_SCRIPT.md).

**Documentação oficial complementar:** [Microsoft WSL](https://learn.microsoft.com/pt-br/windows/wsl/install), [Docker Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Docker + WSL](https://docs.docker.com/desktop/features/wsl/use-wsl/), [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/), [nvm](https://github.com/nvm-sh/nvm).

*Revisado em 13/10/2026 com base na branch `main`; validação funcional na máquina de destino deve ser feita antes da apresentação.*
