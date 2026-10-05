export function computeChargeAmount(args: {
  qty: number;
  unitPrice: number;
  discount: number;
}): number {
  return args.qty * args.unitPrice - args.discount;
}

export function computeDocumentTotals(
  lines: Array<{
    qty: number;
    unitPrice: number;
    discount: number;
    vatRate: number;
    amount: number;
  }>,
): {
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
} {
  let subtotal = 0;
  let discountTotal = 0;
  let vatTotal = 0;
  for (const line of lines) {
    subtotal += line.qty * line.unitPrice;
    discountTotal += line.discount;
    vatTotal += line.amount * line.vatRate;
  }
  const total = subtotal - discountTotal + vatTotal;
  return { subtotal, discountTotal, vatTotal, total };
}
