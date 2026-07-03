import { useNavigate } from "react-router-dom";
import { T, F } from "../lib/tokens";
import { useVentrylStore } from "../store/ventrylStore";
import { Badge, Card } from "../components/shared";

export function OrdersListView({ isMobile }) {
  const navigate = useNavigate();
  const { buyerOrders } = useVentrylStore();

  return (
    <div>
      <div style={{ fontSize: "14px", fontWeight: 800, color: T.black, marginBottom: "14px" }}>My Orders</div>
      {isMobile ? (
        buyerOrders.map((o) => (
          <div key={o.id} onClick={() => navigate(`/orders/${o.id}`)}
            style={{ border: `1px solid ${o.pendingQuote ? T.amber : T.gray100}`, background: T.white, padding: "14px 16px", marginBottom: "8px", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.black}
            onMouseLeave={e => e.currentTarget.style.borderColor = o.pendingQuote ? T.amber : T.gray100}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7px" }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: T.black }}>{o.id}</div>
                <div style={{ fontSize: "11px", color: T.gray400, marginTop: "1px" }}>{o.depot} · {o.product}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <Badge status={o.status} />
                {o.pendingQuote && <span style={{ background: T.amber, color: "#000", fontSize: "9px", fontWeight: 800, padding: "2px 6px", letterSpacing: "0.04em" }}>QUOTE PENDING</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: "14px" }}>
              <span style={{ fontSize: "11px", color: T.gray600, fontWeight: 700 }}>{(o.vol / 1000).toFixed(0)}k L</span>
              <span style={{ fontSize: "11px", fontWeight: 800, color: T.black }}>₦{(o.value || 0).toLocaleString("en-NG")}</span>
              <span style={{ fontSize: "11px", color: T.gray400 }}>{o.placed}</span>
            </div>
          </div>
        ))
      ) : (
        <Card pad={false}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.gray100}` }}>
                {["Order", "Depot", "Product", "Volume", "Trucks", "Value", "Placed", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 18px", fontFamily: F, fontSize: "10px", fontWeight: 700, color: T.gray400, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buyerOrders.map((o, i) => (
                <tr key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  style={{ borderBottom: i < buyerOrders.length - 1 ? `1px solid ${T.gray100}` : "none", cursor: "pointer", background: o.pendingQuote ? "#FFFBF0" : "transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F6F6F6"}
                  onMouseLeave={e => e.currentTarget.style.background = o.pendingQuote ? "#FFFBF0" : "transparent"}>
                  <td style={{ padding: "13px 18px", fontFamily: F, fontSize: "12px", fontWeight: 800, color: T.black }}>{o.id}</td>
                  <td style={{ padding: "13px 18px", fontFamily: F, fontSize: "12px", color: T.gray800 }}>{o.depot}</td>
                  <td style={{ padding: "13px 18px" }}><span style={{ background: T.gray100, color: T.black, fontSize: "10px", fontWeight: 800, padding: "3px 7px" }}>{o.product}</span></td>
                  <td style={{ padding: "13px 18px", fontFamily: F, fontSize: "12px", color: T.gray600 }}>{(o.vol / 1000).toFixed(0)}k L</td>
                  <td style={{ padding: "13px 18px", fontFamily: F, fontSize: "12px", fontWeight: 700, color: T.black, textAlign: "center" }}>{o.trucks}</td>
                  <td style={{ padding: "13px 18px", fontFamily: F, fontSize: "13px", fontWeight: 800, color: T.black }}>₦{(o.value || 0).toLocaleString("en-NG")}</td>
                  <td style={{ padding: "13px 18px", fontFamily: F, fontSize: "11px", color: T.gray400 }}>{o.placed}</td>
                  <td style={{ padding: "13px 18px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                      <Badge status={o.status} />
                      {o.pendingQuote && <span style={{ background: T.amber, color: "#000", fontSize: "9px", fontWeight: 800, padding: "2px 6px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>💰 QUOTE PENDING</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
