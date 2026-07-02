/**
 * Ventryl Document Generation
 * Waybill and Invoice via browser print window — zero extra dependencies.
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
      .box { border: 1px solid #e5e5e5; padding: 16px; }
      .box-dark { background: #111; color: #fff; padding: 16px; }
      .badge { display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
      .badge-green { background: #d1fae5; color: #065f46; }
      .badge-amber { background: #fef3c7; color: #92400e; }
      .divider { border: none; border-top: 2px solid #111; margin: 20px 0; }
      .divider-light { border: none; border-top: 1px solid #eee; margin: 14px 0; }
      .right { text-align: right; }
      .total-row td { font-weight: 800; font-size: 14px; border-top: 2px solid #111; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 10px; color: #888; display: flex; justify-content: space-between; align-items: flex-end; }
      @media print {
        body { padding: 20px; }
        @page { margin: 15mm; }
      }
    </style>
  `;
}

/**
 * Print a waybill for an order.
 * @param {object} data
 *   orderId, product, vol, buyer, buyerAddr, depot, depotAddr, depotLicense,
 *   trucks [{plate, driver, vol, eta}], bay, loadRef, waybillRef, date, type
 */
export function printWaybill(data) {
  const {
    orderId = 'VTL-00000',
    product = 'PMS',
    vol = 0,
    buyer = '',
    buyerAddr = 'Lagos, Nigeria',
    depot = '',
    depotAddr = 'Lagos, Nigeria',
    depotLicense = '',
    trucks = [],
    bay = '',
    loadRef = '',
    waybillRef = '',
    date = new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }),
    type = 'delivery',
  } = data;

  const wbNum = waybillRef || `WB-${orderId}-${Date.now().toString().slice(-4)}`;
  const isPickup = type === 'pickup' || type === 'ex-depot';

  const trucksRows = trucks.length > 0
    ? trucks.map((t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${t.plate || '—'}</td>
          <td>${t.driver || '—'}</td>
          <td>${((parseInt(t.vol) || 0) / 1000).toFixed(1)}k L</td>
          <td>${t.eta || '—'}</td>
        </tr>`).join('')
    : `<tr><td colspan="5" style="color:#888;text-align:center;">No truck details recorded</td></tr>`;

  const html = `<!DOCTYPE html><html><head><title>Waybill ${wbNum}</title>${baseStyles()}</head><body>
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          ${VENTRYL_LOGO}
          <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:0.06em;">VENTRYL</span>
        </div>
        <h1>WAYBILL</h1>
        <div style="font-size:11px;color:#888;margin-top:2px;">${isPickup ? 'Ex-Depot / Pickup' : 'Delivery'} Document</div>
      </div>
      <div style="text-align:right;">
        <div class="label">Waybill No.</div>
        <div style="font-size:18px;font-weight:900;color:#111;">${wbNum}</div>
        <div class="label" style="margin-top:8px;">Date Issued</div>
        <div class="value">${date}</div>
        <div class="label" style="margin-top:8px;">Order Ref</div>
        <div class="value">${orderId}</div>
        ${loadRef ? `<div class="label" style="margin-top:8px;">Load Ref</div><div class="value">${loadRef}</div>` : ''}
      </div>
    </div>

    <hr class="divider"/>

    <!-- PARTIES -->
    <div class="grid2" style="margin-bottom:20px;">
      <div class="box">
        <h2>Consignor (Depot / Seller)</h2>
        <div class="value" style="margin-bottom:4px;">${depot}</div>
        <div style="color:#555;font-size:11px;">${depotAddr}</div>
        ${depotLicense ? `<div style="color:#888;font-size:10px;margin-top:4px;">License: ${depotLicense}</div>` : ''}
        ${bay ? `<div style="color:#888;font-size:10px;margin-top:4px;">Loading Bay: ${bay}</div>` : ''}
      </div>
      <div class="box">
        <h2>Consignee (Buyer)</h2>
        <div class="value" style="margin-bottom:4px;">${buyer}</div>
        <div style="color:#555;font-size:11px;">${buyerAddr}</div>
      </div>
    </div>

    <!-- CARGO DETAILS -->
    <div class="box-dark" style="margin-bottom:20px;">
      <div class="grid3">
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Product</div>
          <div style="font-size:18px;font-weight:900;color:#fff;">${product}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Total Volume</div>
          <div style="font-size:18px;font-weight:900;color:#06C167;">${(vol / 1000).toFixed(1)}k L</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">Transport Mode</div>
          <div style="font-size:15px;font-weight:800;color:#fff;">${isPickup ? 'Buyer Pickup' : 'Depot Delivery'}</div>
        </div>
      </div>
    </div>

    <!-- TRUCK MANIFEST -->
    <h2 style="margin-bottom:10px;">Truck Manifest</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Plate No.</th>
          <th>Driver</th>
          <th>Volume (L)</th>
          <th>ETA</th>
        </tr>
      </thead>
      <tbody>${trucksRows}</tbody>
    </table>

    <!-- CERTIFICATION -->
    <div class="grid2" style="margin-top:32px;gap:32px;">
      <div>
        <h2>Issued By (Depot)</h2>
        <div style="border-bottom:1px solid #111;height:48px;margin-bottom:6px;"></div>
        <div style="font-size:10px;color:#888;">Authorised Signatory · Date</div>
      </div>
      <div>
        <h2>Received By (Buyer / Driver)</h2>
        <div style="border-bottom:1px solid #111;height:48px;margin-bottom:6px;"></div>
        <div style="font-size:10px;color:#888;">Name, Signature · Date</div>
      </div>
    </div>

    <div class="footer">
      <div>This waybill is a legal transport document. Any alteration renders it void.</div>
      <div>Ventryl Platform · ventryl.com</div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}

/**
 * Print an invoice for an order.
 * @param {object} data
 *   orderId, product, vol, pricePerLitre, buyer, buyerAddr, buyerRc,
 *   depot, depotAddr, depotRc, depotLicense,
 *   date, dueDate, invoiceRef, vat (bool, default true)
 */
export function printInvoice(data) {
  const {
    orderId = 'VTL-00000',
    product = 'PMS',
    vol = 0,
    pricePerLitre = 0,
    buyer = '',
    buyerAddr = 'Lagos, Nigeria',
    buyerRc = '',
    depot = '',
    depotAddr = 'Lagos, Nigeria',
    depotRc = '',
    depotLicense = '',
    date = new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }),
    dueDate = '',
    invoiceRef = '',
    vat = true,
  } = data;

  const invNum = invoiceRef || `INV-${orderId}-${Date.now().toString().slice(-4)}`;
  const subtotal = vol * pricePerLitre;
  const vatRate = vat ? 0.075 : 0;
  const vatAmt = subtotal * vatRate;
  const total = subtotal + vatAmt;

  const fmt = (n) => `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const html = `<!DOCTYPE html><html><head><title>Invoice ${invNum}</title>${baseStyles()}</head><body>
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          ${VENTRYL_LOGO}
          <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:0.06em;">VENTRYL</span>
        </div>
        <h1>TAX INVOICE</h1>
        <div style="font-size:11px;color:#888;margin-top:2px;">Petroleum Products Supply</div>
      </div>
      <div style="text-align:right;">
        <div class="label">Invoice No.</div>
        <div style="font-size:18px;font-weight:900;color:#111;">${invNum}</div>
        <div class="label" style="margin-top:8px;">Date</div>
        <div class="value">${date}</div>
        ${dueDate ? `<div class="label" style="margin-top:8px;">Due Date</div><div class="value">${dueDate}</div>` : ''}
        <div class="label" style="margin-top:8px;">Order Ref</div>
        <div class="value">${orderId}</div>
      </div>
    </div>

    <hr class="divider"/>

    <!-- PARTIES -->
    <div class="grid2" style="margin-bottom:20px;">
      <div class="box">
        <h2>Seller</h2>
        <div class="value" style="margin-bottom:4px;">${depot}</div>
        <div style="color:#555;font-size:11px;">${depotAddr}</div>
        ${depotRc ? `<div style="color:#888;font-size:10px;margin-top:4px;">RC: ${depotRc}</div>` : ''}
        ${depotLicense ? `<div style="color:#888;font-size:10px;">NMDPRA: ${depotLicense}</div>` : ''}
      </div>
      <div class="box">
        <h2>Bill To</h2>
        <div class="value" style="margin-bottom:4px;">${buyer}</div>
        <div style="color:#555;font-size:11px;">${buyerAddr}</div>
        ${buyerRc ? `<div style="color:#888;font-size:10px;margin-top:4px;">RC: ${buyerRc}</div>` : ''}
      </div>
    </div>

    <!-- LINE ITEMS -->
    <h2 style="margin-bottom:10px;">Items</h2>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Volume (L)</th>
          <th class="right">Unit Price (₦/L)</th>
          <th class="right">Amount (₦)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight:700;">${product} — Petroleum Product</div>
            <div style="font-size:10px;color:#888;margin-top:2px;">Ex-depot supply per Ventryl order ${orderId}</div>
          </td>
          <td>${vol.toLocaleString('en-NG')}</td>
          <td class="right">${fmt(pricePerLitre)}</td>
          <td class="right">${fmt(subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <!-- TOTALS -->
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <div style="width:280px;">
        <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #eee;">
          <span style="color:#555;">Subtotal</span>
          <span style="font-weight:700;">${fmt(subtotal)}</span>
        </div>
        ${vat ? `
        <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #eee;">
          <span style="color:#555;">VAT (7.5%)</span>
          <span style="font-weight:700;">${fmt(vatAmt)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:12px 10px;background:#111;">
          <span style="color:#fff;font-weight:800;font-size:14px;">TOTAL DUE</span>
          <span style="color:#06C167;font-weight:900;font-size:16px;">${fmt(total)}</span>
        </div>
      </div>
    </div>

    <!-- PAYMENT & NOTES -->
    <div class="grid2" style="margin-top:28px;">
      <div class="box">
        <h2>Payment Instructions</h2>
        <div style="font-size:11px;color:#555;line-height:1.7;">
          All payments processed via Ventryl Wallet.<br/>
          Reference invoice number on all transfers.<br/>
          Late payments attract 2% monthly interest.
        </div>
      </div>
      <div class="box">
        <h2>Notes</h2>
        <div style="font-size:11px;color:#555;line-height:1.7;">
          Goods remain property of seller until full payment.<br/>
          Subject to Ventryl Platform Terms of Trade.<br/>
          Disputes must be raised within 48 hours of delivery.
        </div>
      </div>
    </div>

    <div class="footer">
      <div>This is a computer-generated invoice. Signature not required.</div>
      <div>Ventryl Platform · ventryl.com</div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}
