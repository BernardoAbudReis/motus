import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lembretesDevidos, mediaCircular as mediaServidor, relogioNoFuso } from '../src/lembretes.js'
// A mesma conta existe no app (para mostrar o horário) e no servidor (para enviar).
// Este teste garante que as duas cópias não divirjam.
import { horarioDoLembrete, mediaCircular as mediaApp } from '../../web/src/habitos/lembrete.ts'

function aleatorio(semente: number) {
  let s = semente
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
}

test('média circular: app e servidor dão o mesmo resultado', () => {
  const r = aleatorio(42)
  for (let i = 0; i < 2000; i++) {
    const minutos = Array.from({ length: 1 + Math.floor(r() * 20) }, () => Math.floor(r() * 1440))
    assert.equal(mediaServidor(minutos), mediaApp(minutos), `entrada: ${minutos.join(',')}`)
  }
})

test('horário do lembrete: o servidor avisa exatamente no horário que o app mostra', () => {
  const FUSO = 'UTC' // o app calcula no fuso do aparelho; aqui os dois usam UTC
  const r = aleatorio(7)
  const hoje = Date.UTC(2026, 10, 24)
  for (let i = 0; i < 300; i++) {
    const conclusoes = Array.from({ length: Math.floor(r() * 25) }, (_, k) => hoje - (k + 1) * 86_400_000 + Math.floor(r() * 86_400_000))
    const lembrete = r() < 0.3 ? { ativo: true, modo: 'fixo' as const, horario: '06:45' } : undefined
    const noApp = horarioDoLembrete({ lembrete }, conclusoes, (ms) => relogioNoFuso(ms, FUSO).minutos).minutos

    const registros = conclusoes.map((ms) => ({ habitoId: 'h', data: relogioNoFuso(ms, FUSO).data, concluido: true, concluidoEm: ms }))
    const habito = { id: 'h', dados: { nome: 'Ler', frequencia: { tipo: 'diaria' as const }, criadoEm: 0, lembrete } }
    const avisaNoHorario = lembretesDevidos([habito], registros, hoje + noApp * 60_000, FUSO).length === 1
    const avisaAntes = lembretesDevidos([habito], registros, hoje + (noApp - 1) * 60_000, FUSO).length === 1
    assert.ok(avisaNoHorario && (noApp === 0 || !avisaAntes), `caso ${i}: app mostra ${noApp} min`)
  }
})
