import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function formatSize(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function cleanName(key) {
  const raw = (key || "").split("/").pop() || key;
  return raw.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    ""
  );
}

export default function Trash() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // confirmModal: { type: "restore" | "delete" | "empty", item?: ... }
  const [confirmModal, setConfirmModal] = useState(null);

  async function loadTrash() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/files/trash`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load trash");
        return;
      }
      setItems(data.files || []);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTrash();
  }, []);

  async function doRestore(item) {
    setBusy(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/files/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: item.key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not restore");
        return;
      }
      setItems((prev) => prev.filter((f) => f.key !== item.key));
      setConfirmModal(null);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setBusy(false);
    }
  }

  async function doDeleteForever(item) {
    setBusy(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/files`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: item.key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete");
        return;
      }
      setItems((prev) => prev.filter((f) => f.key !== item.key));
      setConfirmModal(null);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setBusy(false);
    }
  }

  async function doEmptyTrash() {
    setBusy(true);
    const token = localStorage.getItem("token");
    try {
      // Supprime chaque fichier un par un
      for (const item of items) {
        const res = await fetch(`${API_BASE}/api/files`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ key: item.key }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Could not empty trash completely");
          await loadTrash();
          return;
        }
      }
      setItems([]);
      setConfirmModal(null);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setBusy(false);
    }
  }

  function handleConfirm() {
    if (!confirmModal) return;
    if (confirmModal.type === "restore") doRestore(confirmModal.item);
    if (confirmModal.type === "delete") doDeleteForever(confirmModal.item);
    if (confirmModal.type === "empty") doEmptyTrash();
  }

  const modalTitle =
    confirmModal?.type === "restore"
      ? "Restore file?"
      : confirmModal?.type === "delete"
      ? "Delete forever?"
      : confirmModal?.type === "empty"
      ? "Empty trash?"
      : "";

  const modalText =
    confirmModal?.type === "restore"
      ? `"${cleanName(confirmModal.item.key)}" will be moved back to My Files.`
      : confirmModal?.type === "delete"
      ? `"${cleanName(confirmModal.item.key)}" will be permanently deleted. This cannot be undone.`
      : confirmModal?.type === "empty"
      ? `All ${items.length} file(s) in trash will be permanently deleted. This cannot be undone.`
      : "";

  const confirmLabel =
    confirmModal?.type === "restore"
      ? "Restore"
      : confirmModal?.type === "delete"
      ? "Delete forever"
      : "Empty trash";

  const isDanger =
    confirmModal?.type === "delete" || confirmModal?.type === "empty";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 className="page-heading">Trash</h2>
          <p className="page-subtext">
            Files in trash can be restored or permanently deleted.
          </p>
        </div>

        {items.length > 0 && (
          <button
            className="btn btn-danger"
            onClick={() => setConfirmModal({ type: "empty" })}
          >
            Empty trash
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 12, fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading trash…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <TrashIcon />
            </div>
            <div className="empty-state-title">Trash is empty</div>
            <div className="empty-state-text">
              Files you delete will appear here before permanent deletion.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>File Size</th>
                <th>Deleted Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td style={{ fontWeight: 600 }}>{cleanName(item.key)}</td>
                  <td>{formatSize(item.size)}</td>
                  <td>{formatDate(item.lastModified)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn-outline"
                        onClick={() =>
                          setConfirmModal({ type: "restore", item })
                        }
                      >
                        ↺ Restore
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() =>
                          setConfirmModal({ type: "delete", item })
                        }
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de confirmation */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => !busy && setConfirmModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{modalTitle}</div>
            <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
              {modalText}
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                disabled={busy}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className={isDanger ? "btn btn-danger" : "btn btn-solid"}
                disabled={busy}
                onClick={handleConfirm}
              >
                {busy ? "Please wait…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13" />
    </svg>
  );
}