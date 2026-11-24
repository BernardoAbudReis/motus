import { gravarMeta, lerMeta } from './db'

export interface Usuario {
  id: string
  email: string
  nome: string | null
}

export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

export async function lerToken() {
  return lerMeta<string>('token')
}

export async function requisicao<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = await lerToken()
  const resposta = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opcoes.headers,
    },
  })
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}))
    throw new ErroApi(resposta.status, corpo.erro ?? `Erro ${resposta.status}`)
  }
  return resposta.json() as Promise<T>
}

async function guardarSessao(token: string, usuario?: Usuario) {
  await gravarMeta('token', token)
  if (usuario) await gravarMeta('usuario', usuario)
}

/** Entra ou cria a conta. Ao criar, devolve o código de recuperação (mostrado uma única vez). */
export async function entrar(email: string, senha: string, criarConta: boolean, nome?: string) {
  const r = await requisicao<{ token: string; usuario: Usuario; codigoRecuperacao?: string }>(
    criarConta ? '/auth/cadastro' : '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, senha, ...(criarConta && nome ? { nome } : {}) }) },
  )
  await guardarSessao(r.token, r.usuario)
  return { usuario: r.usuario, codigoRecuperacao: r.codigoRecuperacao }
}

/** Esqueci a senha: com o código de recuperação. Devolve o código novo (o antigo deixa de valer). */
export async function redefinirSenha(email: string, codigo: string, novaSenha: string) {
  const r = await requisicao<{ token: string; usuario: Usuario; codigoRecuperacao: string }>('/auth/redefinir-senha', {
    method: 'POST',
    body: JSON.stringify({ email, codigo, novaSenha }),
  })
  await guardarSessao(r.token, r.usuario)
  return r.codigoRecuperacao
}

export async function gerarCodigoRecuperacao(senha: string) {
  const r = await requisicao<{ codigoRecuperacao: string }>('/auth/codigo-recuperacao', { method: 'POST', body: JSON.stringify({ senha }) })
  return r.codigoRecuperacao
}

/** Troca a senha. Este aparelho continua conectado; os outros precisam entrar de novo. */
export async function trocarSenha(senhaAtual: string, novaSenha: string) {
  const r = await requisicao<{ token: string }>('/auth/trocar-senha', { method: 'POST', body: JSON.stringify({ senhaAtual, novaSenha }) })
  await guardarSessao(r.token)
}

/** Exclui a conta no servidor. Os dados deste aparelho continuam aqui. */
export async function excluirConta(senha: string) {
  await requisicao('/auth/conta', { method: 'DELETE', body: JSON.stringify({ senha }) })
  await sair()
}

export async function sair() {
  await gravarMeta('token', null)
  await gravarMeta('usuario', null)
  await gravarMeta('cursor', 0)
}
