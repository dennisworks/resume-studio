import { useEffect, useState } from "react";
import { api, type Config } from "../lib/tauri";

interface Props {
  open: boolean;
  config: Config;
  onClose: () => void;
  onSaved: (config: Config) => void;
  onToast: (msg: string, kind?: "info" | "error") => void;
}

export function SettingsDialog({
  open,
  config,
  onClose,
  onSaved,
  onToast,
}: Props) {
  const [draft, setDraft] = useState<Config>(config);
  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setTokenInput("");
      api.hasToken().then(setHasToken);
    }
  }, [open, config]);

  if (!open) return null;

  async function saveAll() {
    setBusy(true);
    try {
      await api.saveConfig(draft);
      if (tokenInput.trim()) {
        await api.saveToken(tokenInput.trim());
        setHasToken(true);
      }
      onSaved(draft);
      onToast("Settings saved");
      onClose();
    } catch (e) {
      onToast(`Save failed: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function clearToken() {
    setBusy(true);
    try {
      await api.clearToken();
      setHasToken(false);
      onToast("Upload token cleared");
    } catch (e) {
      onToast(`Clear failed: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Settings</h2>

        <label className="dialog__field">
          <span>Resume directory</span>
          <input
            type="text"
            value={draft.resume_dir}
            onChange={(e) => setDraft({ ...draft, resume_dir: e.target.value })}
          />
        </label>

        <label className="dialog__field">
          <span>Build directory (PDF output)</span>
          <input
            type="text"
            value={draft.build_dir}
            onChange={(e) => setDraft({ ...draft, build_dir: e.target.value })}
          />
        </label>

        <label className="dialog__field">
          <span>Typst binary path</span>
          <input
            type="text"
            value={draft.typst_path}
            onChange={(e) => setDraft({ ...draft, typst_path: e.target.value })}
          />
        </label>

        <label className="dialog__field">
          <span>dworks upload URL</span>
          <input
            type="text"
            value={draft.dworks_upload_url}
            onChange={(e) =>
              setDraft({ ...draft, dworks_upload_url: e.target.value })
            }
          />
        </label>

        <label className="dialog__field">
          <span>
            Upload token{" "}
            <em className="dialog__hint-inline">
              {hasToken
                ? "(stored in Keychain — enter a new value to replace)"
                : "(not yet stored)"}
            </em>
          </span>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={hasToken ? "•••••• (set)" : "paste RESUME_UPLOAD_TOKEN"}
          />
        </label>

        <div className="dialog__actions">
          {hasToken && (
            <button type="button" onClick={clearToken} disabled={busy}>
              Clear token
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="toolbar__primary"
            onClick={saveAll}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
