import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/v1";

const STATUS_COLORS = {
  OPEN: { bg: "#ff3b3b22", border: "#ff3b3b", text: "#ff3b3b" },
  INVESTIGATING: { bg: "#ff990022", border: "#ff9900", text: "#ff9900" },
  RESOLVED: { bg: "#00c85222", border: "#00c852", text: "#00c852" },
  CLOSED: { bg: "#44444422", border: "#888", text: "#888" },
};

const NEXT_STATUS = {
  OPEN: "INVESTIGATING",
  INVESTIGATING: "RESOLVED",
  RESOLVED: "CLOSED",
};

export default function App() {
  const [workItems, setWorkItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rca, setRca] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [ingestForm, setIngestForm] = useState({ component_id: "", status: "failure", message: "" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API}/work_items`);
      setWorkItems(res.data);
    } catch {
      showToast("Failed to fetch work items", "error");
    }
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTransition = async (item) => {
    const next = NEXT_STATUS[item.status];
    if (!next) return;
    if (next === "CLOSED" && !rca.trim()) {
      showToast("RCA is required to close an incident", "error");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: next });
      if (next === "CLOSED") params.append("rca", rca);
      await axios.put(`${API}/work_item/${item.id}?${params}`);
      showToast(`Moved to ${next}`);
      setRca("");
      setSelected(null);
      fetchItems();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error updating", "error");
    }
    setLoading(false);
  };

  const handleIngest = async () => {
    if (!ingestForm.component_id || !ingestForm.message) {
      showToast("Fill all fields", "error");
      return;
    }
    try {
      await axios.post(`${API}/ingest`, {
        ...ingestForm,
        timestamp: new Date().toISOString(),
      });
      showToast("Signal ingested!");
      setTimeout(fetchItems, 1500);
    } catch {
      showToast("Ingest failed", "error");
    }
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>⚡ IMS</span>
          <span style={styles.logoSub}>Incident Management System</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.liveTag}>● LIVE</span>
          <span style={styles.itemCount}>{workItems.filter(i => i.status !== "CLOSED").length} Active</span>
        </div>
      </header>

      <div style={styles.body}>
        {/* Left: Ingest + Work Items */}
        <div style={styles.left}>

          {/* Ingest Panel */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>🚨 Ingest Signal</div>
            <input
              style={styles.input}
              placeholder="Component ID (e.g. RDBMS_01)"
              value={ingestForm.component_id}
              onChange={e => setIngestForm({ ...ingestForm, component_id: e.target.value })}
            />
            <select
              style={styles.input}
              value={ingestForm.status}
              onChange={e => setIngestForm({ ...ingestForm, status: e.target.value })}
            >
              <option value="failure">failure</option>
              <option value="warning">warning</option>
              <option value="ok">ok</option>
            </select>
            <input
              style={styles.input}
              placeholder="Message"
              value={ingestForm.message}
              onChange={e => setIngestForm({ ...ingestForm, message: e.target.value })}
            />
            <button style={styles.btn} onClick={handleIngest}>Send Signal</button>
          </div>

          {/* Work Items */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>📋 Incidents</div>
            {workItems.length === 0 && <div style={styles.empty}>No incidents found</div>}
            {workItems.map(item => {
              const colors = STATUS_COLORS[item.status] || STATUS_COLORS.OPEN;
              const isSelected = selected?.id === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.item,
                    borderLeft: `4px solid ${colors.border}`,
                    background: isSelected ? "#1e1e2e" : "#13131f",
                    cursor: "pointer",
                  }}
                  onClick={() => { setSelected(item); setRca(""); }}
                >
                  <div style={styles.itemTop}>
                    <span style={styles.componentId}>{item.component_id}</span>
                    <span style={{ ...styles.badge, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                      {item.status}
                    </span>
                  </div>
                  <div style={styles.itemMeta}>
                    ID #{item.id} · {new Date(item.created_at).toLocaleString()}
                  </div>
                  {item.rca && <div style={styles.rcaPreview}>RCA: {item.rca}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div style={styles.right}>
          {!selected ? (
            <div style={styles.emptyDetail}>
              <div style={styles.emptyIcon}>🔍</div>
              <div>Select an incident to manage it</div>
            </div>
          ) : (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Incident Detail — #{selected.id}</div>

              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Component</span>
                <span style={styles.detailValue}>{selected.component_id}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status</span>
                <span style={{
                  ...styles.badge,
                  background: STATUS_COLORS[selected.status]?.bg,
                  color: STATUS_COLORS[selected.status]?.text,
                  border: `1px solid ${STATUS_COLORS[selected.status]?.border}`
                }}>{selected.status}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Created</span>
                <span style={styles.detailValue}>{new Date(selected.created_at).toLocaleString()}</span>
              </div>
              {selected.resolved_at && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Resolved</span>
                  <span style={styles.detailValue}>{new Date(selected.resolved_at).toLocaleString()}</span>
                </div>
              )}
              {selected.rca && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>RCA</span>
                  <span style={styles.detailValue}>{selected.rca}</span>
                </div>
              )}

              {/* Workflow */}
              {NEXT_STATUS[selected.status] && (
                <div style={{ marginTop: 24 }}>
                  <div style={styles.cardTitle}>
                    Transition → {NEXT_STATUS[selected.status]}
                  </div>

                  {NEXT_STATUS[selected.status] === "CLOSED" && (
                    <div>
                      <div style={styles.detailLabel}>Root Cause Analysis (required)</div>
                      <textarea
                        style={{ ...styles.input, height: 100, resize: "vertical" }}
                        placeholder="Describe the root cause, fix applied, and prevention steps..."
                        value={rca}
                        onChange={e => setRca(e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    style={{ ...styles.btn, marginTop: 12, opacity: loading ? 0.6 : 1 }}
                    onClick={() => handleTransition(selected)}
                    disabled={loading}
                  >
                    {loading ? "Updating..." : `Move to ${NEXT_STATUS[selected.status]}`}
                  </button>
                </div>
              )}

              {selected.status === "CLOSED" && (
                <div style={{ marginTop: 16, color: "#888", fontSize: 13 }}>
                  ✅ This incident is closed.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          ...styles.toast,
          background: toast.type === "error" ? "#ff3b3b" : "#00c852",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0a12",
    color: "#e0e0f0",
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 32px",
    borderBottom: "1px solid #1e1e2e",
    background: "#0d0d1a",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  logo: { fontSize: 22, fontWeight: 700, color: "#7c6af7", letterSpacing: 1 },
  logoSub: { fontSize: 13, color: "#555", letterSpacing: 2, textTransform: "uppercase" },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  liveTag: { color: "#ff3b3b", fontSize: 13, fontWeight: 700, animation: "pulse 1.5s infinite" },
  itemCount: { fontSize: 13, color: "#888" },
  body: { display: "flex", gap: 24, padding: 24, maxWidth: 1200, margin: "0 auto" },
  left: { flex: 1, display: "flex", flexDirection: "column", gap: 20 },
  right: { width: 420 },
  card: {
    background: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: 12,
    padding: 24,
  },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#7c6af7", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 },
  input: {
    width: "100%",
    background: "#0a0a12",
    border: "1px solid #1e1e2e",
    borderRadius: 8,
    color: "#e0e0f0",
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 10,
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    background: "#7c6af7",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 0",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 1,
    fontFamily: "inherit",
  },
  item: {
    borderRadius: 8,
    padding: "14px 16px",
    marginBottom: 10,
    transition: "background 0.2s",
  },
  itemTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  componentId: { fontWeight: 700, fontSize: 14, color: "#e0e0f0" },
  badge: { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: 1 },
  itemMeta: { fontSize: 11, color: "#555" },
  rcaPreview: { fontSize: 11, color: "#7c6af7", marginTop: 6, fontStyle: "italic" },
  empty: { color: "#555", fontSize: 13, textAlign: "center", padding: 20 },
  emptyDetail: {
    background: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: 12,
    padding: 60,
    textAlign: "center",
    color: "#555",
    fontSize: 14,
  },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  detailRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 },
  detailLabel: { fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", paddingTop: 2, minWidth: 80 },
  detailValue: { fontSize: 13, color: "#e0e0f0", textAlign: "right", flex: 1 },
  toast: {
    position: "fixed",
    bottom: 32,
    right: 32,
    padding: "14px 24px",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    zIndex: 999,
    fontFamily: "inherit",
  },
};