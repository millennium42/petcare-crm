import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { fieldOptions, parseClinicDateTime, updateLinkedForm } from './form-options.js'
import './styles.css'

const DEMO_USERS = [
  { role: 'admin', label: 'Administrador', email: 'admin@petcare.local', password: 'Demo123!', note: 'Visão completa e usuários' },
  { role: 'equipe', label: 'Equipe', email: 'equipe@petcare.local', password: 'Demo123!', note: 'Rotina clínica e comercial' },
  { role: 'cliente', label: 'Cliente', email: 'cliente@petcare.local', password: 'Demo123!', note: 'Portal do tutor' },
]

const ROUTES = [
  { id: 'dashboard', label: 'Visão geral', icon: 'grid', roles: ['admin', 'equipe', 'cliente'] },
  { id: 'customers', label: 'Clientes', icon: 'users', roles: ['admin', 'equipe'] },
  { id: 'pets', label: 'Pets', icon: 'paw', roles: ['admin', 'equipe'] },
  { id: 'vaccines', label: 'Vacinas', icon: 'shield', roles: ['admin', 'equipe'] },
  { id: 'services', label: 'Serviços', icon: 'sparkle', roles: ['admin', 'equipe'] },
  { id: 'appointments', label: 'Agenda', icon: 'calendar', roles: ['admin', 'equipe'] },
  { id: 'medical-notes', label: 'Prontuário', icon: 'notes', roles: ['admin', 'equipe'] },
  { id: 'payments', label: 'Pagamentos', icon: 'wallet', roles: ['admin', 'equipe'] },
  { id: 'reminders', label: 'Lembretes', icon: 'bell', roles: ['admin', 'equipe'] },
  { id: 'users', label: 'Usuários', icon: 'lock', roles: ['admin'] },
  { id: 'portal', label: 'Minha área', icon: 'heart', roles: ['cliente'] },
]

const SERVICE_TYPES = ['consulta', 'banho', 'tosa', 'exame', 'hotel', 'procedimento']
const statusOptions = (...values) => values.map((value) => ({ value, label: title(value) }))
const field = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra })
const lookup = (path, value, labels) => ({ path, value, labels })
const personName = (item) => item.customer_name || item.tutor_name || item.name || `#${item.customer_id || item.id}`
const petName = (item) => item.pet_name || item.name || `#${item.pet_id || item.id}`
const owner = (item) => item.customer_name || item.tutor_name || `Cliente #${item.customer_id}`
const pet = (item) => item.pet_name || `Pet #${item.pet_id}`
const value = (key) => (item) => item[key]

const RESOURCES = {
  customers: {
    title: 'Clientes', singular: 'cliente', eyebrow: 'Relacionamento', description: 'Tutores, contatos e preferências em um só lugar.',
    fields: [field('name', 'Nome completo', 'text', { required: true }), field('email', 'E-mail', 'email', { required: true }), field('phone', 'Telefone', 'tel', { required: true }), field('address', 'Endereço'), field('notes', 'Observações', 'textarea')],
    columns: [['name', 'Tutor', personName], ['email', 'E-mail', value('email')], ['phone', 'Telefone', value('phone')], ['address', 'Endereço', value('address')]],
  },
  pets: {
    title: 'Pets', singular: 'pet', eyebrow: 'Pacientes', description: 'Perfis completos ligados aos seus tutores.',
    fields: [field('customer_id', 'Tutor', 'select', { required: true, lookup: lookup('/customers', 'id', ['name', 'email']) }), field('name', 'Nome', 'text', { required: true }), field('species', 'Espécie', 'select', { required: true, options: statusOptions('cão', 'gato', 'ave', 'roedor', 'outro') }), field('breed', 'Raça'), field('sex', 'Sexo', 'select', { required: true, default: 'desconhecido', options: [{ value: 'macho', label: 'Macho' }, { value: 'femea', label: 'Fêmea' }, { value: 'desconhecido', label: 'Desconhecido' }] }), field('birth_date', 'Nascimento', 'date'), field('weight_kg', 'Peso (kg)', 'number', { step: '0.01' }), field('allergies', 'Alergias'), field('notes', 'Observações', 'textarea')],
    columns: [['name', 'Pet', petName], ['customer_name', 'Tutor', owner], ['species', 'Espécie', value('species')], ['breed', 'Raça', value('breed')], ['weight_kg', 'Peso', (item) => item.weight_kg ? `${item.weight_kg} kg` : '—']],
  },
  vaccines: {
    title: 'Vacinas', singular: 'vacina', eyebrow: 'Prevenção', description: 'Histórico de doses e próximos vencimentos.',
    fields: [field('customer_id', 'Tutor', 'select', { required: true, lookup: lookup('/customers', 'id', ['name', 'email']) }), field('pet_id', 'Pet', 'select', { required: true, lookup: lookup('/pets', 'id', ['name', 'customer_name']) }), field('name', 'Vacina', 'text', { required: true }), field('dose', 'Dose'), field('application_date', 'Data de aplicação', 'date', { required: true }), field('next_due_date', 'Próxima dose', 'date'), field('veterinarian', 'Veterinário(a)'), field('status', 'Status', 'select', { required: true, default: 'aplicada', options: statusOptions('aplicada', 'pendente', 'atrasada') })],
    columns: [['name', 'Vacina', value('name')], ['pet_name', 'Pet', pet], ['application_date', 'Aplicada em', (item) => formatDate(item.application_date)], ['next_due_date', 'Próxima dose', (item) => formatDate(item.next_due_date)], ['status', 'Status', (item) => <Status value={item.status} />]],
  },
  services: {
    title: 'Serviços', singular: 'serviço', eyebrow: 'Operação', description: 'Atendimentos clínicos e cuidados do petshop.',
    fields: [field('customer_id', 'Cliente', 'select', { required: true, lookup: lookup('/customers', 'id', ['name', 'email']) }), field('pet_id', 'Pet', 'select', { required: true, lookup: lookup('/pets', 'id', ['name', 'customer_name']) }), field('type', 'Tipo', 'select', { required: true, options: statusOptions(...SERVICE_TYPES) }), field('service_date', 'Data e hora', 'datetime-local', { required: true }), field('status', 'Status', 'select', { required: true, default: 'agendado', options: statusOptions('agendado', 'em_andamento', 'concluido', 'cancelado') }), field('value_cents', 'Valor (centavos)', 'number', { required: true, min: '1' }), field('notes', 'Observações', 'textarea')],
    columns: [['type', 'Serviço', (item) => title(item.type)], ['pet_name', 'Pet', pet], ['service_date', 'Data', (item) => formatDate(item.service_date || item.date)], ['value_cents', 'Valor', (item) => formatMoney(item.value_cents)], ['status', 'Status', (item) => <Status value={item.status} />]],
  },
  appointments: {
    title: 'Agenda', singular: 'agendamento', eyebrow: 'Atendimento', description: 'Compromissos da clínica em uma visão simples.',
    fields: [field('customer_id', 'Cliente', 'select', { required: true, lookup: lookup('/customers', 'id', ['name', 'email']) }), field('pet_id', 'Pet', 'select', { required: true, lookup: lookup('/pets', 'id', ['name', 'customer_name']) }), field('service_type', 'Serviço', 'select', { required: true, options: statusOptions(...SERVICE_TYPES) }), field('scheduled_at', 'Data e hora', 'datetime-local', { required: true }), field('status', 'Status', 'select', { required: true, default: 'agendado', options: statusOptions('agendado', 'confirmado', 'concluido', 'cancelado') }), field('notes', 'Observações', 'textarea')],
    columns: [['scheduled_at', 'Quando', (item) => formatDateTime(item.scheduled_at)], ['pet_name', 'Pet', pet], ['customer_name', 'Tutor', owner], ['service_type', 'Serviço', (item) => title(item.service_type)], ['status', 'Status', (item) => <Status value={item.status} />]],
    statusAction: statusOptions('agendado', 'confirmado', 'concluido', 'cancelado'),
  },
  'medical-notes': {
    title: 'Prontuário', singular: 'registro clínico', eyebrow: 'Saúde', description: 'Observações clínicas objetivas e rastreáveis.',
    fields: [field('pet_id', 'Pet', 'select', { required: true, lookup: lookup('/pets', 'id', ['name', 'customer_name']) }), field('appointment_id', 'Agendamento', 'select', { lookup: lookup('/appointments', 'id', ['pet_name', 'scheduled_at']) }), field('observation', 'Observação clínica', 'textarea', { required: true })],
    columns: [['pet_name', 'Pet', pet], ['observation', 'Observação', value('observation')], ['author_name', 'Responsável', (item) => item.author_name || 'Autor indisponível'], ['created_at', 'Registrado em', (item) => formatDateTime(item.created_at)]],
  },
  payments: {
    title: 'Pagamentos', singular: 'pagamento', eyebrow: 'Financeiro', description: 'Cobranças e recebimentos sem complexidade desnecessária.',
    fields: [field('customer_id', 'Cliente', 'select', { required: true, lookup: lookup('/customers', 'id', ['name', 'email']) }), field('appointment_id', 'Agendamento', 'select', { lookup: lookup('/appointments', 'id', ['pet_name', 'scheduled_at']) }), field('description', 'Descrição', 'text', { required: true }), field('amount_cents', 'Valor (centavos)', 'number', { required: true, min: '1' }), field('method', 'Forma de pagamento', 'select', { required: true, options: [{ value: 'pix', label: 'Pix' }, { value: 'cartao', label: 'Cartão' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'boleto', label: 'Boleto' }, { value: 'outro', label: 'Outro' }] }), field('status', 'Status', 'select', { required: true, default: 'pendente', options: statusOptions('pendente', 'pago', 'atrasado', 'cancelado') }), field('due_date', 'Vencimento', 'date'), field('paid_date', 'Pago em', 'date')],
    columns: [['description', 'Cobrança', value('description')], ['customer_name', 'Cliente', owner], ['amount_cents', 'Valor', (item) => formatMoney(item.amount_cents)], ['due_date', 'Vencimento', (item) => formatDate(item.due_date)], ['status', 'Status', (item) => <Status value={item.status} />]],
    statusAction: statusOptions('pendente', 'pago', 'atrasado', 'cancelado'),
  },
  reminders: {
    title: 'Lembretes', singular: 'lembrete', eyebrow: 'Relacionamento', description: 'Pendências e contatos importantes na hora certa.',
    fields: [field('customer_id', 'Cliente', 'select', { required: true, lookup: lookup('/customers', 'id', ['name', 'email']) }), field('pet_id', 'Pet', 'select', { lookup: lookup('/pets', 'id', ['name', 'customer_name']) }), field('kind', 'Tipo', 'select', { required: true, options: statusOptions('vacina', 'agendamento', 'pagamento', 'retorno', 'outro') }), field('message', 'Mensagem', 'textarea', { required: true }), field('due_at', 'Quando lembrar', 'datetime-local', { required: true }), field('status', 'Status', 'select', { required: true, default: 'pendente', options: statusOptions('pendente', 'enviado', 'concluido', 'cancelado') })],
    columns: [['message', 'Lembrete', value('message')], ['customer_name', 'Cliente', owner], ['pet_name', 'Pet', pet], ['due_at', 'Quando', (item) => formatDateTime(item.due_at)], ['status', 'Status', (item) => <Status value={item.status} />]],
    statusAction: statusOptions('pendente', 'enviado', 'concluido', 'cancelado'),
  },
  users: {
    title: 'Usuários', singular: 'usuário', eyebrow: 'Acessos', description: 'Contas da operação e do portal do cliente.',
    fields: [field('name', 'Nome', 'text', { required: true }), field('email', 'E-mail', 'email', { required: true }), field('password', 'Senha', 'password', { required: true, minLength: 8 }), field('role', 'Papel', 'select', { required: true, options: statusOptions('admin', 'equipe', 'cliente') }), field('customer_id', 'Cliente vinculado', 'select', { lookup: lookup('/customers', 'id', ['name', 'email']) })],
    columns: [['name', 'Nome', value('name')], ['email', 'E-mail', value('email')], ['role', 'Papel', (item) => <Status value={item.role} />], ['active', 'Acesso', (item) => <Status value={item.active === false ? 'inativo' : 'ativo'} />]],
  },
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.')
  return data
}

function title(text = '') {
  return String(text).replaceAll('_', ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function formatMoney(cents) { return cents === null || cents === undefined ? '—' : moneyFormatter.format(Number(cents) / 100) }
function formatDate(date) { return date ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${String(date).slice(0, 10)}T12:00:00`)) : '—' }
function formatDateTime(date) { return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parseClinicDateTime(date)) : '—' }
function getInitials(name = 'PetCare') { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() }

function Icon({ name, size = 20 }) {
  const paths = {
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    paw: 'M12 15c-3.5 0-6 2.2-6 4.3C6 21 7.4 22 9 22c1 0 2-.5 3-.5s2 .5 3 .5c1.6 0 3-1 3-2.7 0-2.1-2.5-4.3-6-4.3M6.5 13C5.1 13 4 11.7 4 10s1.1-3 2.5-3S9 8.3 9 10s-1.1 3-2.5 3m11 0c-1.4 0-2.5-1.3-2.5-3s1.1-3 2.5-3S20 8.3 20 10s-1.1 3-2.5 3M10 8c-1.4 0-2.5-1.3-2.5-3S8.6 2 10 2s2.5 1.3 2.5 3S11.4 8 10 8m4 0c-1.4 0-2.5-1.3-2.5-3S12.6 2 14 2s2.5 1.3 2.5 3S15.4 8 14 8',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10M9 12l2 2 4-4',
    sparkle: 'M12 3l1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8z',
    calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01',
    notes: 'M6 2h9l4 4v16H6zM14 2v5h5M9 12h7M9 16h7M9 8h2',
    wallet: 'M3 6h16v14H3zM3 9h18v7h-5a3 3 0 0 1 0-6h5M16 12h.01',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5a5.5 5.5 0 0 0 1.1-8.9',
    plus: 'M12 5v14M5 12h14',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    close: 'M18 6 6 18M6 6l12 12',
    menu: 'M4 6h16M4 12h16M4 18h16',
    logout: 'M10 17l5-5-5-5M15 12H3M15 3h5v18h-5',
    refresh: 'M20 6v6h-6M4 18v-6h6M5.5 9a7 7 0 0 1 12-2.5L20 12M4 12l2.5 5.5A7 7 0 0 0 18.5 15',
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.sparkle} /></svg>
}

function Status({ value: status }) {
  const normalized = String(status ?? '—').toLowerCase()
  const tone = /pago|conclu|aplicada|ativo|enviado|confirmado/.test(normalized) ? 'success' : /atras|cancel|inativo/.test(normalized) ? 'danger' : 'warning'
  return <span className={`status ${tone}`}><i />{title(normalized)}</span>
}

function Loading({ label = 'Carregando dados...' }) { return <div className="state"><span className="spinner" /><strong>{label}</strong><small>Só um instante.</small></div> }
function Empty({ title: heading = 'Nada por aqui ainda', text = 'Crie o primeiro registro para começar.' }) { return <div className="state empty"><span className="empty-icon"><Icon name="paw" size={28} /></span><strong>{heading}</strong><small>{text}</small></div> }
function ErrorState({ message, retry }) { return <div className="state error"><strong>Não conseguimos carregar</strong><small>{message}</small>{retry && <button className="button ghost" onClick={retry}><Icon name="refresh" size={16} />Tentar novamente</button>}</div> }

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: 'admin@petcare.local', password: 'Demo123!' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event, demo) {
    event?.preventDefault()
    const credentials = demo || form
    setLoading(true); setError('')
    try { await onLogin(credentials) } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return <main className="login-shell">
    <section className="login-story">
      <div className="brand light"><span className="brand-mark"><Icon name="paw" size={25} /></span><span>PetCare<small>CRM veterinário</small></span></div>
      <div className="story-copy">
        <span className="pill">Gestão que cuida</span>
        <h1>Mais tempo para os pets.<br />Mais clareza para o negócio.</h1>
        <p>Agenda, prontuário, serviços e relacionamento em uma experiência simples para a equipe e para os tutores.</p>
      </div>
      <div className="story-proof"><div><strong>360°</strong><span>visão da operação</span></div><div><strong>1 lugar</strong><span>para toda a jornada</span></div><div><strong>LGPD</strong><span>privacidade desde o início</span></div></div>
      <div className="pet-orbit" aria-hidden="true"><span>🐕</span><i /><b>🐈</b></div>
    </section>
    <section className="login-panel">
      <div className="login-card">
        <header><span className="eyebrow">Bem-vindo de volta</span><h2>Acesse sua conta</h2><p>Use seu e-mail e senha ou entre com um perfil de demonstração.</p></header>
        <form onSubmit={submit}>
          <label>E-mail<input autoFocus autoComplete="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Senha<input autoComplete="current-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <button className="button primary wide" disabled={loading}>{loading ? <><span className="spinner small" />Entrando...</> : <>Entrar <Icon name="arrow" size={18} /></>}</button>
        </form>
        <div className="divider"><span>Perfis de demonstração</span></div>
        <div className="demo-list">
          {DEMO_USERS.map((demo) => <button key={demo.role} onClick={() => { setForm(demo); submit(null, demo) }} disabled={loading}><span className={`demo-avatar ${demo.role}`}>{demo.role[0].toUpperCase()}</span><span><strong>{demo.label}</strong><small>{demo.note}</small></span><Icon name="arrow" size={16} /></button>)}
        </div>
        <small className="privacy-note"><Icon name="shield" size={15} /> Ambiente demonstrativo com dados fictícios.</small>
      </div>
    </section>
  </main>
}

function Dashboard({ user }) {
  const remote = useRemote('/dashboard')
  if (remote.loading) return <Loading label="Montando seu panorama..." />
  if (remote.error) return <ErrorState message={remote.error} retry={remote.reload} />
  const data = remote.data || {}
  const summary = data.summary || data.metrics || data
  const customerView = user.role === 'cliente'
  const cards = customerView ? [
    ['Meus pets', metric(summary, 'pets', 'pet_count'), 'paw', 'mint'],
    ['Próximas vacinas', metric(summary, 'due_vaccines', 'vaccines_due'), 'shield', 'gold'],
    ['Agendamentos', metric(summary, 'appointments', 'upcoming_appointments'), 'calendar', 'lavender'],
    ['Pagamentos abertos', metric(summary, 'open_payments', 'pending_payments'), 'wallet', 'rose'],
  ] : [
    ['Clientes ativos', metric(summary, 'customers', 'customer_count', 'total_customers'), 'users', 'mint'],
    ['Pets cadastrados', metric(summary, 'pets', 'pet_count', 'total_pets'), 'paw', 'lavender'],
    ['Agenda de hoje', metric(summary, 'today_appointments', 'appointments_today'), 'calendar', 'gold'],
    ['Vacinas próximas', metric(summary, 'due_vaccines', 'vaccines_due'), 'shield', 'rose'],
    ['Cobranças abertas', metric(summary, 'open_payments', 'pending_payments'), 'wallet', 'sky'],
    ['Lembretes próximos', metric(summary, 'upcoming_reminders', 'reminders'), 'bell', 'peach'],
  ]
  const appointments = collection(data, 'today_appointments', 'appointments')
  const reminders = collection(data, 'upcoming_reminders', 'reminders')
  const vaccines = collection(data, 'due_vaccines', 'vaccines')
  return <div className="dashboard-grid">
    <section className="hero-banner">
      <div><span className="eyebrow light">{customerView ? 'Seu espaço PetCare' : 'Operação em tempo real'}</span><h2>{customerView ? `Tudo bem por aí, ${user.name?.split(' ')[0] || 'tutor'}?` : 'Sua clínica em boas mãos.'}</h2><p>{customerView ? 'Acompanhe a saúde e os próximos cuidados dos seus pets.' : 'O essencial do dia, organizado para decisões rápidas e atendimento melhor.'}</p></div>
      <div className="hero-art" aria-hidden="true"><span>🐾</span><b>✓</b></div>
    </section>
    <section className="metric-grid">{cards.map(([label, number, icon, tone]) => <article className="metric-card" key={label}><span className={`metric-icon ${tone}`}><Icon name={icon} size={22} /></span><div><strong>{number}</strong><span>{label}</span></div><small>Dados atualizados</small></article>)}</section>
    <section className="panel wide-panel">
      <PanelHeader eyebrow="Hoje" title="Próximos atendimentos" />
      {appointments.length ? <div className="timeline-list">{appointments.slice(0, 5).map((item, index) => <div key={item.id || index}><time>{formatHour(item.scheduled_at)}</time><span className="timeline-dot" /><span><strong>{item.pet_name || item.pet?.name || 'Pet'}</strong><small>{title(item.service_type || item.type)} · {item.customer_name || item.tutor_name || 'Tutor'}</small></span><Status value={item.status} /></div>)}</div> : <Empty title="Agenda tranquila" text="Nenhum atendimento previsto neste período." />}
    </section>
    <section className="panel">
      <PanelHeader eyebrow="Atenção" title="Vacinas a vencer" />
      <CompactList items={vaccines} icon="shield" primary={(item) => item.pet_name || 'Pet'} secondary={(item) => `${item.name || 'Vacina'} · ${formatDate(item.next_due_date)}`} empty="Nenhuma vacina próxima." />
    </section>
    <section className="panel">
      <PanelHeader eyebrow="Relacionamento" title="Lembretes" />
      <CompactList items={reminders} icon="bell" primary={(item) => item.message || title(item.kind)} secondary={(item) => formatDateTime(item.due_at)} empty="Nenhum lembrete pendente." />
    </section>
  </div>
}

function PanelHeader({ eyebrow, title: heading }) { return <header className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h3>{heading}</h3></div></header> }
function CompactList({ items, icon, primary, secondary, empty, limit = 4 }) { return items.length ? <div className="compact-list">{items.slice(0, limit).map((item, index) => <div key={item.id || index}><span><Icon name={icon} size={18} /></span><p><strong>{primary(item)}</strong><small>{secondary(item)}</small></p></div>)}</div> : <Empty title={empty} text="Você está em dia." /> }

function metric(object, ...keys) {
  for (const key of keys) {
    const current = object?.[key]
    if (typeof current === 'number' || typeof current === 'string') return current
    if (Array.isArray(current)) return current.length
    if (current && typeof current === 'object') return current.total ?? current.count ?? 0
  }
  return 0
}
function collection(object, ...keys) { for (const key of keys) if (Array.isArray(object?.[key])) return object[key]; return [] }
function formatHour(date) { return date ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(parseClinicDateTime(date)) : '—' }

function hydrateItem(item, lookups) {
  const linkedPet = (lookups['/pets'] || []).find((current) => current.id === item.pet_id)
  const linkedCustomer = (lookups['/customers'] || []).find((current) => current.id === (item.customer_id || linkedPet?.customer_id))
  return { ...item, pet_name: item.pet_name || linkedPet?.name, customer_name: item.customer_name || linkedCustomer?.name }
}

function ResourcePage({ resource, user }) {
  const config = RESOURCES[resource]
  const [items, setItems] = useState([])
  const [lookups, setLookups] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const defaults = useMemo(() => Object.fromEntries(config.fields.map((item) => [item.name, item.default ?? (item.type === 'checkbox' ? false : '')])), [config])
  const [form, setForm] = useState(defaults)
  const canWrite = user.role !== 'cliente'

  async function load() {
    setLoading(true); setError('')
    try { const data = await api(`/${resource}`); setItems(data.items || []) } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [resource])
  useEffect(() => {
    if (!canWrite) return
    const targets = [...new Map(config.fields.filter((item) => item.lookup).map((item) => [item.lookup.path, item.lookup])).values()]
    Promise.all(targets.map(async (target) => [target.path, (await api(target.path)).items || []])).then((entries) => setLookups(Object.fromEntries(entries))).catch(() => setLookups({}))
  }, [resource, canWrite, config])

  function optionsFor(item) {
    return fieldOptions(item, lookups, form)
  }

  function updateForm(fieldName, current) {
    setForm((previous) => updateLinkedForm(previous, fieldName, current, lookups))
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    const body = Object.fromEntries(Object.entries(form).filter(([, current]) => current !== '').map(([key, current]) => {
      const definition = config.fields.find((item) => item.name === key)
      return [key, ['number', 'select'].includes(definition?.type) && /(_id|_cents)$/.test(key) ? Number(current) : current]
    }))
    try {
      await api(`/${resource}`, { method: 'POST', body })
      setModal(false); setForm(defaults); setNotice(`${title(config.singular)} criado com sucesso.`); await load()
      setTimeout(() => setNotice(''), 3500)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  async function changeStatus(item, status) {
    try { await api(`/${resource}/${item.id}/status`, { method: 'PATCH', body: { status } }); setNotice('Status atualizado.'); await load() } catch (err) { setError(err.message) }
  }

  return <section className="resource-page">
    <header className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h2>{config.title}</h2><p>{config.description}</p></div>{canWrite && <button className="button primary" onClick={() => { setError(''); setModal(true) }}><Icon name="plus" size={18} />Novo {config.singular}</button>}</header>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    <div className="table-card">
      <div className="table-toolbar"><strong>{items.length} {items.length === 1 ? 'registro' : 'registros'}</strong><button className="icon-button" onClick={load} aria-label="Atualizar"><Icon name="refresh" size={18} /></button></div>
      {loading ? <Loading /> : error && !modal ? <ErrorState message={error} retry={load} /> : items.length ? <div className="table-scroll"><table><thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label}</th>)}{config.statusAction && <th>Atualizar</th>}</tr></thead><tbody>{items.map((item) => { const row = hydrateItem(item, lookups); return <tr key={item.id}>{config.columns.map(([key, , render]) => <td key={key} data-label={config.columns.find(([column]) => column === key)?.[1]}>{render(row) || '—'}</td>)}{config.statusAction && <td data-label="Atualizar"><select className="status-select" aria-label="Atualizar status" value={item.status || ''} onChange={(event) => changeStatus(item, event.target.value)}>{config.statusAction.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>}</tr> })}</tbody></table></div> : <Empty />}
    </div>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><span className="eyebrow">Novo cadastro</span><h2 id="modal-title">Adicionar {config.singular}</h2></div><button className="icon-button" aria-label="Fechar" onClick={() => setModal(false)}><Icon name="close" /></button></header><form onSubmit={submit}><div className="form-grid">{config.fields.map((item) => <FormField key={item.name} field={item} value={form[item.name]} options={optionsFor(item)} onChange={(current) => updateForm(item.name, current)} />)}</div>{error && <div className="inline-error" role="alert">{error}</div>}<footer><button type="button" className="button ghost" onClick={() => setModal(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? <><span className="spinner small" />Salvando...</> : 'Salvar cadastro'}</button></footer></form></section></div>}
  </section>
}

function FormField({ field: input, value: current, options, onChange }) {
  if (input.type === 'checkbox') return <label className="checkbox-field"><input type="checkbox" checked={Boolean(current)} onChange={(event) => onChange(event.target.checked)} /><span>{input.label}</span></label>
  const attributes = { required: input.required, min: input.min, step: input.step, minLength: input.minLength, value: current, onChange: (event) => onChange(event.target.value) }
  if (input.type === 'textarea') return <label className="full-field">{input.label}{input.required && <sup>*</sup>}<textarea rows="3" {...attributes} /></label>
  if (input.type === 'select') return <label>{input.label}{input.required && <sup>*</sup>}<select {...attributes}><option value="">Selecione</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  return <label>{input.label}{input.required && <sup>*</sup>}<input type={input.type} {...attributes} /></label>
}

function Portal() {
  const remote = useRemote('/portal')
  if (remote.loading) return <Loading label="Preparando a área do cliente..." />
  if (remote.error) return <ErrorState message={remote.error} retry={remote.reload} />
  const data = remote.data || {}
  const customer = data.customer || data.profile || {}
  const pets = collection(data, 'pets')
  const withPetNames = (key) => collection(data, key).map((item) => hydrateItem(item, { '/pets': pets }))
  return <div className="portal-grid">
    <section className="portal-hero"><div className="portal-avatar"><Icon name="heart" size={28} /></div><div><span className="eyebrow light">Área do cliente</span><h2>Olá, {customer.name?.split(' ')[0] || 'tutor'}!</h2><p>{customer.email || 'Acompanhe aqui toda a jornada dos seus pets.'}</p></div><span className="portal-seal"><Icon name="shield" size={18} /> Dados protegidos</span></section>
    <section className="panel portal-pets"><PanelHeader eyebrow="Sua família" title="Meus pets" />{pets.length ? <div className="pet-cards">{pets.map((item) => <article key={item.id}><span>{String(item.species).toLowerCase().includes('gat') ? '🐈' : '🐕'}</span><div><h3>{item.name}</h3><p>{[item.breed, title(item.species)].filter(Boolean).join(' · ')}</p><small>{item.weight_kg ? `${item.weight_kg} kg` : 'Perfil atualizado'}</small></div></article>)}</div> : <Empty title="Nenhum pet vinculado" text="Fale com a equipe para atualizar seu cadastro." />}</section>
    <PortalSection title="Próximos agendamentos" eyebrow="Agenda" items={withPetNames('appointments')} icon="calendar" primary={(item) => `${item.pet_name || 'Pet'} · ${title(item.service_type)}`} secondary={(item) => formatDateTime(item.scheduled_at)} />
    <PortalSection title="Vacinas" eyebrow="Prevenção" items={withPetNames('vaccines')} icon="shield" primary={(item) => `${item.pet_name || 'Pet'} · ${item.name}`} secondary={(item) => `Próxima: ${formatDate(item.next_due_date)}`} />
    <PortalSection title="Serviços recentes" eyebrow="Histórico" items={withPetNames('services')} icon="sparkle" primary={(item) => `${item.pet_name || 'Pet'} · ${title(item.type)}`} secondary={(item) => `${formatDate(item.service_date || item.date)} · ${formatMoney(item.value_cents)}`} />
    <PortalSection title="Observações clínicas" eyebrow="Prontuário" items={withPetNames('medical_notes')} icon="notes" primary={(item) => `${item.pet_name || 'Pet'} · ${item.observation}`} secondary={(item) => `${item.author_name || 'Autor indisponível'} · ${formatDateTime(item.created_at)}`} />
    <PortalSection title="Pagamentos" eyebrow="Financeiro" items={collection(data, 'payments')} icon="wallet" primary={(item) => item.description} secondary={(item) => `${formatMoney(item.amount_cents)} · ${title(item.status)}`} />
    <PortalSection title="Lembretes" eyebrow="Cuidados" items={collection(data, 'reminders')} icon="bell" primary={(item) => item.message} secondary={(item) => formatDateTime(item.due_at)} />
  </div>
}

function PortalSection({ title: heading, eyebrow, items, icon, primary, secondary }) { return <section className="panel"><PanelHeader eyebrow={eyebrow} title={heading} /><CompactList items={items} icon={icon} primary={primary} secondary={secondary} empty="Nada pendente por aqui." limit={items.length} /></section> }

function useRemote(path) {
  const [state, setState] = useState({ loading: true, error: '', data: null, key: 0 })
  useEffect(() => { let active = true; setState((current) => ({ ...current, loading: true, error: '' })); api(path).then((data) => active && setState((current) => ({ ...current, data, loading: false }))).catch((error) => active && setState((current) => ({ ...current, error: error.message, loading: false }))); return () => { active = false } }, [path, state.key])
  return { ...state, reload: () => setState((current) => ({ ...current, key: current.key + 1 })) }
}

function App() {
  const [session, setSession] = useState({ loading: true, user: null })
  const [route, setRoute] = useState(() => location.hash.slice(1) || 'dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { api('/auth/me').then((data) => setSession({ loading: false, user: data.user || data })).catch(() => setSession({ loading: false, user: null })) }, [])
  useEffect(() => { const change = () => setRoute(location.hash.slice(1) || 'dashboard'); addEventListener('hashchange', change); return () => removeEventListener('hashchange', change) }, [])

  async function login(credentials) { const data = await api('/auth/login', { method: 'POST', body: credentials }); setSession({ loading: false, user: data.user || data }); location.hash = 'dashboard' }
  async function logout() { try { await api('/auth/logout', { method: 'POST' }) } finally { setSession({ loading: false, user: null }) } }

  if (session.loading) return <div className="app-loading"><span className="brand-mark"><Icon name="paw" size={28} /></span><Loading label="Abrindo o PetCare..." /></div>
  if (!session.user) return <Login onLogin={login} />
  const user = session.user
  const allowedRoutes = ROUTES.filter((item) => item.roles.includes(user.role))
  const activeRoute = allowedRoutes.find((item) => item.id === route) || allowedRoutes[0]
  const navigate = (id) => { location.hash = id; setMenuOpen(false) }
  return <div className="app-shell">
    <button className={`menu-scrim ${menuOpen ? 'visible' : ''}`} aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
    <aside className={menuOpen ? 'open' : ''}>
      <div className="brand"><span className="brand-mark"><Icon name="paw" size={24} /></span><span>PetCare<small>CRM veterinário</small></span></div>
      <div className="clinic-card"><span>PC</span><div><strong>PetCare Clínica</strong><small>Unidade demonstrativa</small></div></div>
      <nav aria-label="Navegação principal">{allowedRoutes.map((item) => <button key={item.id} className={activeRoute.id === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-footer"><span className="avatar">{getInitials(user.name)}</span><div><strong>{user.name || title(user.role)}</strong><small>{title(user.role)}</small></div><button onClick={logout} aria-label="Sair"><Icon name="logout" size={18} /></button></div>
    </aside>
    <main className="app-main">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Icon name="menu" /></button><div><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span><h1>{activeRoute.label}</h1></div><div className="topbar-actions"><span className="role-chip">{title(user.role)}</span><span className="avatar">{getInitials(user.name)}</span></div></header>
      <div className="content">{activeRoute.id === 'dashboard' ? <Dashboard user={user} /> : activeRoute.id === 'portal' ? <Portal /> : <ResourcePage resource={activeRoute.id} user={user} />}</div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
