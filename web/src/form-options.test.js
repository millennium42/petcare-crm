import assert from 'node:assert/strict'
import test from 'node:test'
import { fieldOptions, updateLinkedForm } from './form-options.js'

const petField = { lookup: { path: '/pets', value: 'id', labels: ['name', 'customer_name'] } }
const lookups = { '/pets': [
  { id: 1, customer_id: 10, name: 'Nina', customer_name: 'Ana' },
  { id: 2, customer_id: 20, name: 'Thor', customer_name: 'Bruno' },
] }

test('fieldOptions filters pet options by selected tutor', () => {
  assert.deepEqual(fieldOptions(petField, lookups, { customer_id: '10' }), [
    { value: 1, label: 'Nina · Ana' },
  ])
})

test('updateLinkedForm clears selected pet when tutor changes', () => {
  assert.deepEqual(updateLinkedForm({ customer_id: '10', pet_id: '1' }, 'customer_id', '20', lookups), {
    customer_id: '20',
    pet_id: '',
  })
})
