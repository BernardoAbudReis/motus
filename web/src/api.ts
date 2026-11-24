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

export async function entrar(email: string, senha: string, criarConta: boolean, nome?: string) {
  const { token, usuario } = await requisicao<{ token: string; usuario: Usuario }>(
    criarConta ? '/auth/cadastro' : '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, senha, nome }) },
  )
  await gravarMeta('token', token)
  await gravarMeta('usuario', usuario)
  return usuario
}

export async function sair() {
  await gravarMeta('token', null)
  await gravarMeta('usuario', null)
  await gravarMeta('cursor', 0)
}
