export function fieldOptions(field, lookups, form = {}) {
  if (field.options) return field.options
  if (!field.lookup) return []
  const customerId = form.customer_id ? Number(form.customer_id) : null
  const options = (lookups[field.lookup.path] || []).filter((option) => (
    field.lookup.path !== '/pets' || !customerId || Number(option.customer_id) === customerId
  ))
  return options.map((option) => ({
    value: option[field.lookup.value],
    label: field.lookup.labels.map((key) => option[key]).filter(Boolean).join(' · ') || `#${option.id}`,
  }))
}

export function updateLinkedForm(form, fieldName, value, lookups) {
  const next = { ...form, [fieldName]: value }
  if (fieldName === 'customer_id' && next.pet_id) {
    const selectedPet = (lookups['/pets'] || []).find((pet) => String(pet.id) === String(next.pet_id))
    if (selectedPet && String(selectedPet.customer_id) !== String(value)) next.pet_id = ''
  }
  return next
}
