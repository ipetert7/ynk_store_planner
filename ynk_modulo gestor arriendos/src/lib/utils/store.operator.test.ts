import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanOperatorName, normalizeOperatorName, getUniqueOperators } from './store'

test('cleanOperatorName trims and collapses spaces', () => {
  assert.equal(cleanOperatorName('  Mall   Plaza  '), 'Mall Plaza')
  assert.equal(cleanOperatorName(''), '')
})

test('normalizeOperatorName compares ignoring case and extra spaces', () => {
  assert.equal(normalizeOperatorName('  plaza  '), 'plaza')
  assert.equal(normalizeOperatorName('CENCOSUD'), 'cencosud')
})

test('getUniqueOperators returns canonical unique list', () => {
  const stores = [
    { shoppingCenterOperator: 'Plaza' },
    { shoppingCenterOperator: '  plaza ' },
    { shoppingCenterOperator: 'Cencosud' },
    { shoppingCenterOperator: 'CENCOSUD' },
    { shoppingCenterOperator: 'Nuevo Operador' },
    { shoppingCenterOperator: '' },
  ] as any

  assert.deepEqual(getUniqueOperators(stores), ['Cencosud', 'Nuevo Operador', 'Plaza'])
})
