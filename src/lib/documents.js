/**
 * Ventryl Document Generation
 * Waybill, Invoice, Delivery Receipt, and Transaction Receipt
 * via browser print window — zero extra dependencies.
 */

const VENTRYL_LOGO = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="28" fill="#06C167"/>
  <path d="M7 8h14M7 14h10M7 20h12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Allow pop-ups to download documents.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

const fmt = (n) => `\u20A6${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d || new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtVol = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k L` : `${v} L`;

function baseStyles() {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 40px; }
      h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
      h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #555; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #111; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; text-align: left; }
      td { padding: 9px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
      tr:last-child td { border-bottom: none; }
      .label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
      .value { font-size: 13px; font-weight: 700; color: #111; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
      .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
      .box { border: 1px solid #e5e5e5; padding: 16px; }
      .box-dark { background: #111; color: #fff; padding: 16px; }
      .box-green { background: #d1fae5; border: 1px solid #06C167; padding: 16px; }
      .badge { display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
      .badge-green { background: #d1fae5; color: #065f46; }
      .badge-amber { background: #fef3c7; color: #92400e; }
      .badge-red { background: #fee2e2; color: #991b1b; }
      .badge-blue { background: #dbeafe; color: #1e40af; }
      .badge-paid { background: #06C167; color: #fff; }
      .divider { border: none; border-top: 2px solid #111; margin: 20px 0; }
      .divider-light { border: none; border-top: 1px solid #eee; margin: 14px 0; }
      .right { text-align: right; }
      .total-row td { font-weight: 800; font-size: 14px; border-top: 2px solid #111; }
      .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(0,0,0,0.03); letter-spacing: 0.1em; pointer-events: none; z-index: -1; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 10px; color: #888; display: flex; justify-content: space-between; align-items: flex-end; }
      .sig-box { border-bottom: 1px solid #111; height: 48px; margin-bottom: 6px; }
      .meta-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #eee; }
      .meta-row:last-child { border-bottom: none; }
      .meta-label { color: #888; font-size: 11px; }
      .meta-value { font-weight: 700; font-size: 12px; }
      @media print {
        body { padding: 20px; }
        @page { margin: 15mm; }
        .no-print { display: none !important; }
      }
    </style>
  `;
}

function docHeader(title, subtitle, refLabel, refValue, date, extra = '') {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          ${VENTRYL_LOGO}
          <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:0.06em;">VENTRYL</span>
        </div>
        <h1>${title}</h1>
        <div style="font-size:11px;color:#888;margin-top:2px;">${subtitle}</div>
      </div>
      <div style="text-align:right;">
        <div class="label">${refLabel}</div>
        <div style="font-size:18px;font-weight:900;color:#111;">${refValue}</div>
        <div class="label" style="margin-top:8px;">Date</div>
        <div class="value">${fmtDate(date)}</div>
        ${extra}
      </div>
    </div>
    <hr class="divider"/>
  `;
}

function docFooter(note) {
  return `
    <div class="footer">
      <div>${note}</div>
      <div>Ventryl Platform &middot; ventryl.com</div>
    </div>
  `;
}

function partiesGrid(left, right) {
  return `
    <div class="grid2" style="margin-bottom:20px;">
      <div class="box">
        <h2>${left.title}</h2>
        <div class="value" style="margin-bottom:4px;">${left.name}</div>
        <div style="color:#555;font-size:11px;">${left.addr || ''}</div>
        ${left.rc ? `<div style="color:#888;font-size:10px;margin-top:4px;">RC: ${left.rc}</div>` : ''}
        ${left.license ? `<div style="color:#888;font-size:10px;margin-top:2px;">NMDPRA: ${left.license}</div>` : ''}
        ${left.extra || ''}
      </div>
      <div class="box">
        <h2>${right.title}</h2>
        <div class="value" style="margin-bottom:4px;">${right.name}</div>
        <div style="color:#555;font-size:11px;">${right.addr || ''}</div>
        ${right.rc ? `<div style="color:#888;font-size:10px;margin-top:4px;">RC: ${right.rc}</div>` : ''}
        ${right.extra || ''}
      </div>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════════════════════
// 1. WAYBILL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {object} data
 *   orderId, product, vol, buyer, buyerAddr, depot, depotAddr, depotLicense,
 *   trucks [{plate, driver, vol, eta}], bay, loadRef, waybillRef, date, type,
 *   sealNumbers, depotContact, buyerContact
 */
export function printWaybill(data) {
  const {
    orderId = 'VTL-00000', product = 'PMS', vol = 0,
    buyer = '', buyerAddr = 'Lagos, Nigeria',
    depot = '', depotAddr = 'Lagos, Nigeria', depotLicense = '',
    trucks = [], bay = '', loadRef = '', waybillRef = '',
    date, type = 'delivery',
    sealNumbers = [], depotContact = '', buyerContact = '',
  } = data;

  const wbNum = waybillRef || `WB-${orderId}-${Date.now().toString().slice(-4)}`;
  const isPickup = type === 'pickup' || type === 'ex-depot';

  const trucksRows = trucks.length > 0
    ? trucks.map((t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="font-weight:700;">${t.plate || '\u2014'}</td>
          <td>${t.driver || '\u2014'}</td>
          <td>${fmtVol(parseInt(t.vol) || 0)}</td>
          <td>${sealNumbers[i] || '\u2014'}</td>
          <td>${t.eta || '\u2014'}</td>
        </tr>`).join('')
    : `<tr><td colspan="6" style="color:#888;text-align:center;">No truck details recorded</td></tr>`;

  const html = `<!DOCTYPE html><html><head><title>Waybill ${wbNum}</title>${baseStyles()}</head><body>
    <div class="watermark">WAYBILL</div>
    ${docHeader('WAYBILL', isPickup ? 'Ex-Depot / Pickup Document' : 'Delivery Transport Document', 'Waybill No.', wbNum, date,
      `<div class="label" style="margin-top:8px;">Order Ref</div><div class="value">${orderId}</div>
       ${loadRef ? `<div class="label" style="margin-top:8px;">Load Ref</div><div class="value">${loadRef}</div>` : ''}`
    )}

    ${partiesGrid(
      { title: 'Consignor (Depot / Seller)', name: depot, addr: depotAddr, license: depotLicense,
        extra: (bay ? `<div style="color:#888;font-size:10px;margin-top:4px;">Loading Bay: ${bay}</div>` : '')
          + (depotContact ? `<div style="color:#888;font-size:10px;margin-top:2px;">Contact: ${depotContact}</div>` : '') },
      { title: 'Consignee (Buyer)', name: buyer, addr: buyerAddr,
        extra: buyerContact ? `<div style="color:#888;font-size:10px;margin-top:4px;">Contact: ${buyerContact}</div>` : '' }
    )}

    <!-- CARGO DETAILS -->
    <div class="box-dark" style="margin-bottom:20px;">
      <div class="grid3">
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Product</div>
          <div style="font-size:18px;font-weight:900;color:#fff;">${product}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Total Volume</div>
          <div style="font-size:18px;font-weight:900;color:#06C167;">${fmtVol(vol)}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Transport Mode</div>
          <div style="font-size:15px;font-weight:800;color:#fff;">${isPickup ? 'Buyer Pickup' : 'Depot Delivery'}</div>
          <div style="font-size:10px;color:#888;margin-top:2px;">${trucks.length} truck${trucks.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>

    <!-- TRUCK MANIFEST -->
    <h2 style="margin-bottom:10px;">Truck Manifest</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Plate No.</th><th>Driver</th><th>Volume</th><th>Seal No.</th><th>ETA</th></tr>
      </thead>
      <tbody>${trucksRows}</tbody>
    </table>

    <!-- SAFETY & COMPLIANCE -->
    <div class="box" style="margin-top:20px;">
      <h2>Safety & Compliance Declaration</h2>
      <div style="font-size:11px;color:#555;line-height:1.8;">
        1. All vehicles have valid NMDPRA transport permits and insurance.<br/>
        2. Tanks have been inspected, sealed, and confirmed leak-free before departure.<br/>
        3. Drivers have valid safety training certificates (DPR/NMDPRA).<br/>
        4. Product quality certified at point of loading — depot assumes liability until delivery confirmation.<br/>
        5. Any seal breakage or tampering must be reported immediately to both parties and Ventryl.
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="grid2" style="margin-top:28px;gap:32px;">
      <div>
        <h2>Loaded & Released By (Depot)</h2>
        <div class="sig-box"></div>
        <div style="font-size:10px;color:#888;">Name &middot; Signature &middot; Date &middot; Time</div>
      </div>
      <div>
        <h2>${isPickup ? 'Collected By (Buyer)' : 'Received By (Driver)'}</h2>
        <div class="sig-box"></div>
        <div style="font-size:10px;color:#888;">Name &middot; Signature &middot; Date &middot; Time</div>
      </div>
    </div>

    ${docFooter('This waybill is a legal transport document under Nigerian petroleum regulations. Any alteration renders it void.')}
  </body></html>`;

  openPrintWindow(html);
}


// ═══════════════════════════════════════════════════════════════════════════
// 2. TAX INVOICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {object} data
 *   orderId, items [{product, vol, pricePerLitre}] OR single: product, vol, pricePerLitre,
 *   buyer, buyerAddr, buyerRc, depot, depotAddr, depotRc, depotLicense,
 *   date, dueDate, invoiceRef, vat (bool), vatPercent (number),
 *   platformFee, deliveryFee, status ('paid'|'unpaid'|'partial')
 */
export function printInvoice(data) {
  const {
    orderId = 'VTL-00000',
    product = 'PMS', vol = 0, pricePerLitre = 0,
    items = null,
    buyer = '', buyerAddr = 'Lagos, Nigeria', buyerRc = '',
    depot = '', depotAddr = 'Lagos, Nigeria', depotRc = '', depotLicense = '',
    date, dueDate = '', invoiceRef = '',
    vat = true, vatPercent = 7.5,
    platformFee = 0, deliveryFee = 0,
    status = '',
  } = data;

  const invNum = invoiceRef || `INV-${orderId}-${Date.now().toString().slice(-4)}`;

  // Support multi-item or single-item
  const lineItems = items || [{ product, vol, pricePerLitre }];
  const subtotal = lineItems.reduce((s, i) => s + (i.vol * i.pricePerLitre), 0);
  const vatRate = vat ? (vatPercent / 100) : 0;
  const vatAmt = subtotal * vatRate;
  const total = subtotal + vatAmt + (platformFee || 0) + (deliveryFee || 0);

  const statusBadge = status === 'paid' ? '<span class="badge badge-paid">PAID</span>'
    : status === 'partial' ? '<span class="badge badge-amber">PARTIAL</span>'
    : status === 'unpaid' ? '<span class="badge badge-red">UNPAID</span>'
    : '';

  const itemRows = lineItems.map((item, i) => `
    <tr>
      <td>
        <div style="font-weight:700;">${item.product} \u2014 Petroleum Product</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">Line ${i + 1} \u2014 Ex-depot supply per order ${orderId}</div>
      </td>
      <td>${(item.vol || 0).toLocaleString('en-NG')} L</td>
      <td class="right">${fmt(item.pricePerLitre)}</td>
      <td class="right">${fmt(item.vol * item.pricePerLitre)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Invoice ${invNum}</title>${baseStyles()}</head><body>
    <div class="watermark">INVOICE</div>
    ${docHeader('TAX INVOICE', 'Petroleum Products Supply', 'Invoice No.', invNum, date,
      `${statusBadge ? `<div style="margin-top:8px;">${statusBadge}</div>` : ''}
       ${dueDate ? `<div class="label" style="margin-top:8px;">Due Date</div><div class="value">${dueDate}</div>` : ''}
       <div class="label" style="margin-top:8px;">Order Ref</div><div class="value">${orderId}</div>`
    )}

    ${partiesGrid(
      { title: 'Seller', name: depot, addr: depotAddr, rc: depotRc, license: depotLicense },
      { title: 'Bill To', name: buyer, addr: buyerAddr, rc: buyerRc }
    )}

    <!-- LINE ITEMS -->
    <h2 style="margin-bottom:10px;">Items</h2>
    <table>
      <thead>
        <tr><th>Description</th><th>Volume</th><th class="right">Unit Price (\u20A6/L)</th><th class="right">Amount (\u20A6)</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- TOTALS -->
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <div style="width:300px;">
        <div class="meta-row"><span class="meta-label">Subtotal</span><span class="meta-value">${fmt(subtotal)}</span></div>
        ${vat ? `<div class="meta-row"><span class="meta-label">VAT (${vatPercent}%)</span><span class="meta-value">${fmt(vatAmt)}</span></div>` : ''}
        ${platformFee ? `<div class="meta-row"><span class="meta-label">Platform Fee</span><span class="meta-value">${fmt(platformFee)}</span></div>` : ''}
        ${deliveryFee ? `<div class="meta-row"><span class="meta-label">Delivery Fee</span><span class="meta-value">${fmt(deliveryFee)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:12px 10px;background:#111;margin-top:4px;">
          <span style="color:#fff;font-weight:800;font-size:14px;">TOTAL DUE</span>
          <span style="color:#06C167;font-weight:900;font-size:16px;">${fmt(total)}</span>
        </div>
      </div>
    </div>

    <!-- PAYMENT & NOTES -->
    <div class="grid2" style="margin-top:28px;">
      <div class="box">
        <h2>Payment Terms</h2>
        <div style="font-size:11px;color:#555;line-height:1.7;">
          Payment processed via Ventryl Wallet escrow.<br/>
          Funds held upon order placement.<br/>
          Released to seller upon buyer delivery confirmation.<br/>
          Reference: ${invNum}
        </div>
      </div>
      <div class="box">
        <h2>Terms & Conditions</h2>
        <div style="font-size:11px;color:#555;line-height:1.7;">
          Goods remain property of seller until full payment.<br/>
          Subject to Ventryl Platform Terms of Trade.<br/>
          Disputes must be raised within 48 hours of delivery.<br/>
          Late payments attract 2% monthly interest.
        </div>
      </div>
    </div>

    ${docFooter('This is a computer-generated tax invoice. No signature required.')}
  </body></html>`;

  openPrintWindow(html);
}


// ═══════════════════════════════════════════════════════════════════════════
// 3. DELIVERY RECEIPT / GOODS RECEIVED NOTE (GRN)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {object} data
 *   orderId, product, vol, buyer, buyerAddr, depot, depotAddr,
 *   trucks [{plate, driver, vol}], deliveredAt, confirmedAt, confirmedBy,
 *   condition ('good'|'damaged'|'shortage'), shortageVol,
 *   notes, waybillRef, invoiceRef
 */
export function printDeliveryReceipt(data) {
  const {
    orderId = 'VTL-00000', product = 'PMS', vol = 0,
    buyer = '', buyerAddr = 'Lagos, Nigeria',
    depot = '', depotAddr = 'Lagos, Nigeria',
    trucks = [],
    deliveredAt = '', confirmedAt = '', confirmedBy = '',
    condition = 'good', shortageVol = 0,
    notes = '', waybillRef = '', invoiceRef = '',
  } = data;

  const receiptNum = `GRN-${orderId}-${Date.now().toString().slice(-4)}`;
  const condBadge = condition === 'good'
    ? '<span class="badge badge-green">GOOD CONDITION</span>'
    : condition === 'shortage'
    ? '<span class="badge badge-amber">SHORTAGE REPORTED</span>'
    : '<span class="badge badge-red">DAMAGE REPORTED</span>';

  const trucksRows = trucks.length > 0
    ? trucks.map((t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="font-weight:700;">${t.plate || '\u2014'}</td>
          <td>${t.driver || '\u2014'}</td>
          <td>${fmtVol(parseInt(t.vol) || 0)}</td>
          <td><span class="badge badge-green">RECEIVED</span></td>
        </tr>`).join('')
    : `<tr><td colspan="5" style="color:#888;text-align:center;">No truck details available</td></tr>`;

  const html = `<!DOCTYPE html><html><head><title>Delivery Receipt ${receiptNum}</title>${baseStyles()}</head><body>
    <div class="watermark">RECEIVED</div>
    ${docHeader('DELIVERY RECEIPT', 'Goods Received Note (GRN)', 'Receipt No.', receiptNum, confirmedAt || deliveredAt,
      `<div class="label" style="margin-top:8px;">Order Ref</div><div class="value">${orderId}</div>
       ${waybillRef ? `<div class="label" style="margin-top:8px;">Waybill</div><div class="value">${waybillRef}</div>` : ''}
       ${invoiceRef ? `<div class="label" style="margin-top:8px;">Invoice</div><div class="value">${invoiceRef}</div>` : ''}`
    )}

    ${partiesGrid(
      { title: 'Delivered From (Depot)', name: depot, addr: depotAddr },
      { title: 'Received By (Buyer)', name: buyer, addr: buyerAddr,
        extra: confirmedBy ? `<div style="color:#888;font-size:10px;margin-top:4px;">Confirmed by: ${confirmedBy}</div>` : '' }
    )}

    <!-- DELIVERY SUMMARY -->
    <div class="box-dark" style="margin-bottom:20px;">
      <div class="grid4">
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Product</div>
          <div style="font-size:18px;font-weight:900;color:#fff;">${product}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Volume Ordered</div>
          <div style="font-size:18px;font-weight:900;color:#06C167;">${fmtVol(vol)}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Volume Received</div>
          <div style="font-size:18px;font-weight:900;color:#fff;">${fmtVol(shortageVol ? vol - shortageVol : vol)}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Condition</div>
          <div style="margin-top:4px;">${condBadge}</div>
        </div>
      </div>
    </div>

    ${shortageVol ? `
    <div class="box" style="border-color:#D97706;background:#fef3c7;margin-bottom:20px;">
      <h2 style="color:#92400e;">Shortage / Discrepancy</h2>
      <div style="font-size:12px;color:#92400e;line-height:1.6;">
        <strong>${fmtVol(shortageVol)}</strong> shortage reported.
        Ordered: ${fmtVol(vol)} &middot; Received: ${fmtVol(vol - shortageVol)}.
        ${notes ? `<br/>Note: ${notes}` : ''}
      </div>
    </div>` : ''}

    <!-- TRUCK DELIVERY LOG -->
    <h2 style="margin-bottom:10px;">Truck Delivery Log</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Plate No.</th><th>Driver</th><th>Volume</th><th>Status</th></tr>
      </thead>
      <tbody>${trucksRows}</tbody>
    </table>

    <!-- DELIVERY TIMELINE -->
    <div class="box" style="margin-top:20px;">
      <h2>Delivery Timeline</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div class="label">Dispatched</div>
          <div class="value">${deliveredAt || '\u2014'}</div>
        </div>
        <div>
          <div class="label">Receipt Confirmed</div>
          <div class="value">${confirmedAt || '\u2014'}</div>
        </div>
      </div>
      ${notes && !shortageVol ? `<div style="margin-top:12px;"><div class="label">Notes</div><div style="font-size:11px;color:#555;margin-top:4px;">${notes}</div></div>` : ''}
    </div>

    <!-- CONFIRMATION -->
    <div class="grid2" style="margin-top:28px;gap:32px;">
      <div>
        <h2>Delivered By</h2>
        ${trucks.length > 0
          ? trucks.map((t, i) => `<div style="font-size:13px;font-weight:700;color:#111;margin-top:6px;">${t.driver || '\u2014'}</div>
              <div style="font-size:10px;color:#888;">Truck ${i + 1}: ${t.plate || '\u2014'}</div>`).join('')
          : '<div style="font-size:13px;font-weight:700;color:#111;margin-top:6px;">\u2014</div>'}
      </div>
      <div>
        <h2>Received & Inspected By</h2>
        <div style="font-size:13px;font-weight:700;color:#111;margin-top:6px;">${confirmedBy || '\u2014'}</div>
        ${confirmedAt
          ? '<div style="margin-top:8px;"><span class="badge badge-green">CONFIRMED</span></div><div style="font-size:10px;color:#888;margin-top:4px;">Confirmed: ' + confirmedAt + '</div>'
          : '<div style="font-size:10px;color:#888;margin-top:4px;">Pending confirmation</div>'}
      </div>
    </div>

    <div class="box-green" style="margin-top:24px;text-align:center;">
      <div style="font-size:14px;font-weight:800;color:#065f46;">GOODS RECEIVED &amp; CONFIRMED</div>
      <div style="font-size:11px;color:#065f46;margin-top:4px;">
        This receipt confirms that the above goods have been received and inspected.
        Payment will be released to the seller via Ventryl Wallet escrow.
      </div>
    </div>

    ${docFooter('This delivery receipt serves as official proof of goods received. Retain for your records.')}
  </body></html>`;

  openPrintWindow(html);
}


// ═══════════════════════════════════════════════════════════════════════════
// 4. TRANSACTION RECEIPT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {object} data
 *   txnId, type ('topup'|'hold'|'release'|'credit'|'debit'|'fee'|'refund'),
 *   amount, currency, description, date,
 *   userName, userCompany,
 *   orderId (optional), reference (optional), paymentMethod (optional),
 *   balanceBefore, balanceAfter
 */
export function printTransactionReceipt(data) {
  const {
    txnId = 'TXN-00000', type = 'credit',
    amount = 0, currency = 'NGN', description = '',
    date,
    userName = '', userCompany = '',
    orderId = '', reference = '', paymentMethod = '',
    balanceBefore = null, balanceAfter = null,
  } = data;

  const receiptNum = `TXR-${txnId}`;
  const isCredit = ['topup', 'credit', 'release', 'refund'].includes(type);
  const typeLabels = {
    topup: 'Wallet Top-Up', hold: 'Escrow Hold', release: 'Escrow Release',
    credit: 'Credit', debit: 'Debit', fee: 'Platform Fee', refund: 'Refund',
  };

  const html = `<!DOCTYPE html><html><head><title>Transaction ${receiptNum}</title>${baseStyles()}</head><body>
    ${docHeader('TRANSACTION RECEIPT', 'Ventryl Wallet', 'Receipt No.', receiptNum, date, '')}

    <!-- ACCOUNT HOLDER -->
    <div class="box" style="margin-bottom:20px;">
      <h2>Account Holder</h2>
      <div class="value">${userCompany || userName}</div>
      ${userCompany && userName ? `<div style="color:#555;font-size:11px;">${userName}</div>` : ''}
      <div style="color:#888;font-size:10px;margin-top:4px;">Ventryl Wallet &middot; ${currency}</div>
    </div>

    <!-- TRANSACTION DETAILS -->
    <div class="box-dark" style="margin-bottom:20px;">
      <div style="text-align:center;padding:12px 0;">
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:6px;">${typeLabels[type] || type}</div>
        <div style="font-size:36px;font-weight:900;color:${isCredit ? '#06C167' : '#fff'};letter-spacing:-0.02em;">
          ${isCredit ? '+' : '-'}${fmt(Math.abs(amount))}
        </div>
        <div style="margin-top:10px;">
          <span class="badge ${isCredit ? 'badge-green' : 'badge-amber'}">${isCredit ? 'CREDITED' : 'DEBITED'}</span>
        </div>
      </div>
    </div>

    <!-- DETAILS TABLE -->
    <h2 style="margin-bottom:10px;">Transaction Details</h2>
    <div style="border:1px solid #e5e5e5;">
      <div class="meta-row"><span class="meta-label">Transaction ID</span><span class="meta-value">${txnId}</span></div>
      <div class="meta-row"><span class="meta-label">Type</span><span class="meta-value">${typeLabels[type] || type}</span></div>
      <div class="meta-row"><span class="meta-label">Description</span><span class="meta-value">${description}</span></div>
      <div class="meta-row"><span class="meta-label">Amount</span><span class="meta-value" style="color:${isCredit ? '#06C167' : '#111'};">${isCredit ? '+' : '-'}${fmt(Math.abs(amount))}</span></div>
      <div class="meta-row"><span class="meta-label">Currency</span><span class="meta-value">${currency}</span></div>
      <div class="meta-row"><span class="meta-label">Date & Time</span><span class="meta-value">${fmtDate(date)}</span></div>
      ${reference ? `<div class="meta-row"><span class="meta-label">Payment Reference</span><span class="meta-value">${reference}</span></div>` : ''}
      ${paymentMethod ? `<div class="meta-row"><span class="meta-label">Payment Method</span><span class="meta-value">${paymentMethod}</span></div>` : ''}
      ${orderId ? `<div class="meta-row"><span class="meta-label">Order Reference</span><span class="meta-value">${orderId}</span></div>` : ''}
    </div>

    ${balanceBefore !== null && balanceAfter !== null ? `
    <!-- BALANCE SUMMARY -->
    <div style="display:flex;justify-content:flex-end;margin-top:16px;">
      <div style="width:280px;border:1px solid #e5e5e5;">
        <div class="meta-row"><span class="meta-label">Balance Before</span><span class="meta-value">${fmt(balanceBefore)}</span></div>
        <div class="meta-row"><span class="meta-label">Balance After</span><span class="meta-value" style="font-size:14px;color:#06C167;">${fmt(balanceAfter)}</span></div>
      </div>
    </div>` : ''}

    <div class="box" style="margin-top:24px;">
      <h2>Important Notice</h2>
      <div style="font-size:11px;color:#555;line-height:1.7;">
        This receipt confirms the above transaction on your Ventryl Wallet.<br/>
        For disputes or inquiries, contact support with your Transaction ID.<br/>
        All wallet transactions are final and subject to Ventryl's Terms of Service.
      </div>
    </div>

    ${docFooter('This is an electronic receipt generated by the Ventryl Platform. No signature required.')}
  </body></html>`;

  openPrintWindow(html);
}


// ═══════════════════════════════════════════════════════════════════════════
// 5. ORDER SUMMARY / PURCHASE ORDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {object} data
 *   orderId, product, vol, pricePerLitre, buyer, buyerAddr, buyerRc,
 *   depot, depotAddr, depotLicense, trucks, type,
 *   status, placedAt, vat, vatPercent, platformFee, deliveryFee,
 *   timeline [{status, time, note}]
 */
export function printOrderSummary(data) {
  const {
    orderId = 'VTL-00000', product = 'PMS', vol = 0, pricePerLitre = 0,
    buyer = '', buyerAddr = '', buyerRc = '',
    depot = '', depotAddr = '', depotLicense = '',
    trucks = 0, type = 'delivery',
    status = 'pending', placedAt = '',
    vat = true, vatPercent = 7.5, platformFee = 0, deliveryFee = 0,
    timeline = [],
  } = data;

  const subtotal = vol * pricePerLitre;
  const vatAmt = vat ? subtotal * (vatPercent / 100) : 0;
  const total = subtotal + vatAmt + platformFee + deliveryFee;

  const statusBadges = {
    pending: 'badge-amber', confirmed: 'badge-blue', loading: 'badge-blue',
    in_transit: 'badge-blue', delivered: 'badge-green', collected: 'badge-green',
    rejected: 'badge-red', disputed: 'badge-amber',
  };
  const statusLabels = {
    pending: 'PENDING', confirmed: 'CONFIRMED', loading: 'LOADING',
    in_transit: 'IN TRANSIT', delivered: 'DELIVERED', collected: 'COLLECTED',
    rejected: 'REJECTED', disputed: 'DISPUTED',
  };

  const timelineRows = timeline.length > 0
    ? timeline.map(t => `
        <tr>
          <td><span class="badge ${statusBadges[t.status] || 'badge-amber'}">${statusLabels[t.status] || t.status}</span></td>
          <td>${t.time || '\u2014'}</td>
          <td style="color:#555;">${t.note || '\u2014'}</td>
        </tr>`).join('')
    : '';

  const html = `<!DOCTYPE html><html><head><title>Order ${orderId}</title>${baseStyles()}</head><body>
    ${docHeader('ORDER SUMMARY', type === 'pickup' ? 'Ex-Depot Pickup Order' : 'Delivery Order', 'Order No.', orderId, placedAt,
      `<div style="margin-top:8px;"><span class="badge ${statusBadges[status] || 'badge-amber'}">${statusLabels[status] || status}</span></div>`
    )}

    ${partiesGrid(
      { title: 'Seller (Depot)', name: depot, addr: depotAddr, license: depotLicense },
      { title: 'Buyer', name: buyer, addr: buyerAddr, rc: buyerRc }
    )}

    <!-- ORDER DETAILS -->
    <div class="box-dark" style="margin-bottom:20px;">
      <div class="grid4">
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Product</div>
          <div style="font-size:18px;font-weight:900;color:#fff;">${product}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Volume</div>
          <div style="font-size:18px;font-weight:900;color:#06C167;">${fmtVol(vol)}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Unit Price</div>
          <div style="font-size:15px;font-weight:800;color:#fff;">${fmt(pricePerLitre)}/L</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Trucks</div>
          <div style="font-size:15px;font-weight:800;color:#fff;">${trucks}</div>
        </div>
      </div>
    </div>

    <!-- COST BREAKDOWN -->
    <h2 style="margin-bottom:10px;">Cost Breakdown</h2>
    <div style="display:flex;justify-content:flex-end;">
      <div style="width:320px;border:1px solid #e5e5e5;">
        <div class="meta-row"><span class="meta-label">${product} \u00D7 ${vol.toLocaleString('en-NG')} L</span><span class="meta-value">${fmt(subtotal)}</span></div>
        ${vat ? `<div class="meta-row"><span class="meta-label">VAT (${vatPercent}%)</span><span class="meta-value">${fmt(vatAmt)}</span></div>` : ''}
        ${platformFee ? `<div class="meta-row"><span class="meta-label">Platform Fee</span><span class="meta-value">${fmt(platformFee)}</span></div>` : ''}
        ${deliveryFee ? `<div class="meta-row"><span class="meta-label">Delivery Fee</span><span class="meta-value">${fmt(deliveryFee)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:12px 10px;background:#111;">
          <span style="color:#fff;font-weight:800;font-size:14px;">TOTAL</span>
          <span style="color:#06C167;font-weight:900;font-size:16px;">${fmt(total)}</span>
        </div>
      </div>
    </div>

    ${timelineRows ? `
    <!-- ORDER TIMELINE -->
    <h2 style="margin-top:24px;margin-bottom:10px;">Order Timeline</h2>
    <table>
      <thead><tr><th>Status</th><th>Date & Time</th><th>Note</th></tr></thead>
      <tbody>${timelineRows}</tbody>
    </table>` : ''}

    ${docFooter('This order summary is for informational purposes. For official invoices, use the Tax Invoice document.')}
  </body></html>`;

  openPrintWindow(html);
}
