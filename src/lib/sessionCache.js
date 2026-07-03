// Module-level session caches — persist across navigation within a browser session.
// These are plain JS objects for synchronous read/write in useState initialisers.
// A future migration to Zustand slices is straightforward from here.
export const _deliveryQuoteStore  = {};  // orderId -> {rounds, status}
export const _orderStatusStore    = {};  // orderId -> status string
export const _orderBayStore       = {};  // orderId -> bay string
export const _orderTruckListStore = {};  // orderId -> liveTrucks array
export const _orderDispatchedStore= {};  // orderId -> boolean
export const _orderStatusLogStore = {};  // orderId -> liveTimeline array
export const _gateRecordStore     = {};  // orderId -> {buyerTrucks, waybillRef, gateNote}
export const _buyerConfirmedStore = {};  // orderId -> boolean
