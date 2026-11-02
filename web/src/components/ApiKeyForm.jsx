import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { api } from "../lib/api.js";
import { useToast } from "./Toast.jsx";
import { ICON, Spinner } from "./ui.jsx";

export default function ApiKeyForm({ submitLabel = "Connect", onDone }) {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const qc = useQueryClient();
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cfg = await api.post("/session/key", { apiKey: value });
      qc.setQueryData(["session"], cfg);
      qc.invalidateQueries();
      setValue("");
      toast.show("API key saved to .env");
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="field">
      <label htmlFor="api-key">API key</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="api-key"
          className="input mono"
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your API key"
          autoComplete="off"
          spellCheck={false}
          style={{ fontSize: 13 }}
        />
        <button type="button" className="btn icon" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide key" : "Show key"}>
          {shown ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
        </button>
        <button className="btn accent" disabled={!value.trim() || busy}>
          {busy && <Spinner size={14} />}
          {submitLabel}
        </button>
      </div>
      {error ? (
        <span className="hint negative">{error}</span>
      ) : (
        <span className="hint">Checked, then saved to this project's .env file</span>
      )}
    </form>
  );
}
