// Eligibility is separate from the workflow status used for approval and payment.
export function isPartiallyAllowedRequisition(row) {
  if (Number(row.statusId ?? row.StatusId) === 9) return false
  const items = row.items ?? row.Items ?? []
  const denied = items.reduce((sum, item) => sum + Number(item.deniedQty ?? item.DeniedQty ?? 0), 0)
  const requested = items.reduce((sum, item) => sum + Number(item.quantity ?? item.Quantity ?? 0), 0)
  return denied > 0 && denied < requested
}

export function getRequisitionStatusLabel(row) {
  const statusId = Number(row.statusId ?? row.StatusId)
  const partial = isPartiallyAllowedRequisition(row)
  const label = ({ 10: 'รออนุมัติ', 6: 'รอจัดของ', 8: 'ค้าง', 7: 'ได้ของครบ', 9: 'ไม่ให้เบิก' })[statusId]
    ?? row.status ?? row.Status ?? ''
  if (!partial) return label
  const backlog = (row.items ?? row.Items ?? []).reduce((sum, item) =>
    sum + getRequisitionItemQuantities(item, statusId).backlogQty, 0)
  if (backlog > 0) {
    return `${statusId === 10 ? 'รออนุมัติ' : 'ค้าง'} · มีรายการไม่ให้เบิก`
  }
  return 'เบิกได้บางส่วน'
}

export function getRequisitionItemQuantities(item, statusId) {
  const quantity = Math.max(0, Number(item.quantity ?? item.Quantity ?? 0))
  const fulfilledQty = Math.min(quantity, Math.max(0, Number(item.fulfilledQty ?? item.FulfilledQty ?? 0)))
  const deniedQty = Number(statusId) === 9
    ? quantity - fulfilledQty
    : Math.min(quantity - fulfilledQty, Math.max(0, Number(item.deniedQty ?? item.DeniedQty ?? 0)))
  return { quantity, fulfilledQty, deniedQty, backlogQty: quantity - fulfilledQty - deniedQty }
}
