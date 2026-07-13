import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  defaultUploadName,
  pdfPathFor,
  type Config,
  type ResumeFile,
} from "./lib/tauri";
import { FileTree } from "./components/FileTree";
import { Editor } from "./components/Editor";
import { StructuredEditor } from "./components/StructuredEditor";
import { PdfPreview } from "./components/PdfPreview";
import { Toolbar } from "./components/Toolbar";
import { UploadDialog } from "./components/UploadDialog";
import { NewVariantDialog } from "./components/NewVariantDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { ToastStack, type ToastMessage } from "./components/Toast";
import "./styles.css";

function editPathFor(file: ResumeFile): string {
  return file.json_path ?? file.typ_path;
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [activeFile, setActiveFile] = useState<ResumeFile | null>(null);
  const [savedContent, setSavedContent] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [pdfCacheKey, setPdfCacheKey] = useState<number | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newVariantOpen, setNewVariantOpen] = useState(false);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ResumeFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => void;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);

  const dirty = content !== savedContent;
  const isStructured = !!activeFile?.json_path;

  const pushToast = useCallback(
    (text: string, kind: ToastMessage["kind"] = "info") => {
      toastId.current += 1;
      const id = toastId.current;
      setToasts((prev) => [...prev, { id, text, kind }]);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.getConfig();
        setConfig(cfg);
        const list = await api.listResumes(cfg.resume_dir);
        setFiles(list);
        const master = list.find((f) => f.is_master) ?? list[0];
        if (master) await openFile(master, cfg);
      } catch (e) {
        pushToast(`Init failed: ${e}`, "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openFile(file: ResumeFile, cfg: Config | null = config) {
    try {
      const text = await api.readFile(editPathFor(file));
      setActiveFile(file);
      setSavedContent(text);
      setContent(text);

      if (cfg) {
        const pdfPath = pdfPathFor(file, cfg.build_dir);
        try {
          const mtime = await api.fileMtime(pdfPath);
          setPdfCacheKey(mtime);
        } catch {
          setPdfCacheKey(null);
        }
      }
    } catch (e) {
      pushToast(`Open failed: ${e}`, "error");
    }
  }

  function handleSelect(file: ResumeFile) {
    if (dirty && file.typ_path !== activeFile?.typ_path) {
      setConfirmPrompt({
        title: "Discard unsaved changes?",
        message: `"${activeFile?.name}" has unsaved changes that will be lost.`,
        confirmLabel: "Discard",
        action: () => openFile(file),
      });
      return;
    }
    openFile(file);
  }

  const save = useCallback(async () => {
    if (!activeFile || !dirty) return;
    try {
      await api.writeFile(editPathFor(activeFile), content);
      setSavedContent(content);
      pushToast("Saved");
    } catch (e) {
      pushToast(`Save failed: ${e}`, "error");
    }
  }, [activeFile, dirty, content, pushToast]);

  const compile = useCallback(async () => {
    if (!activeFile || !config) return;
    if (dirty) {
      try {
        await api.writeFile(editPathFor(activeFile), content);
        setSavedContent(content);
      } catch (e) {
        pushToast(`Save before compile failed: ${e}`, "error");
        return;
      }
    }
    setCompiling(true);
    try {
      const pdfPath = pdfPathFor(activeFile, config.build_dir);
      await api.compileTypst(
        config.typst_path,
        config.resume_dir,
        activeFile.typ_path,
        pdfPath,
      );
      const mtime = await api.fileMtime(pdfPath);
      setPdfCacheKey(mtime);
      pushToast("Compiled");
    } catch (e) {
      pushToast(`Compile failed: ${e}`, "error");
    } finally {
      setCompiling(false);
    }
  }, [activeFile, config, dirty, content, pushToast]);

  async function openInPreview() {
    if (!activeFile || !config) return;
    try {
      const pdfPath = pdfPathFor(activeFile, config.build_dir);
      await api.openInPreview(pdfPath);
    } catch (e) {
      pushToast(`Open in Preview failed: ${e}`, "error");
    }
  }

  async function uploadPayload(): Promise<string> {
    if (isStructured) {
      return await api.renderResumeText(content);
    }
    return content;
  }

  async function submitUpload(name: string, activate: boolean) {
    if (!activeFile || !config) return;
    setUploading(true);
    try {
      const payload = await uploadPayload();
      const result = await api.uploadToDworks(
        config.dworks_upload_url,
        name.trim(),
        payload,
        activate,
      );
      if (result.ok) {
        pushToast(`Uploaded "${name}" to dworks`);
        setUploadOpen(false);
      } else {
        pushToast(
          `Upload failed (${result.status}): ${result.body || "no body"}`,
          "error",
        );
      }
    } catch (e) {
      pushToast(`Upload failed: ${e}`, "error");
    } finally {
      setUploading(false);
    }
  }

  async function createVariant(slug: string, source: "current" | "master") {
    if (!config) return;
    setCreatingVariant(true);
    try {
      let seed: string;
      if (source === "current" && isStructured) {
        seed = content;
      } else {
        const master = files.find((f) => f.is_master);
        if (!master?.json_path) throw new Error("master JSON not found");
        seed = await api.readFile(master.json_path);
      }
      const created = await api.createVariant(config.resume_dir, slug, seed);
      const list = await api.listResumes(config.resume_dir);
      setFiles(list);
      const next = list.find((f) => f.typ_path === created.typ_path) ?? created;
      await openFile(next, config);
      setNewVariantOpen(false);
      pushToast(`Created ${created.name}`);
    } catch (e) {
      pushToast(`Create variant failed: ${e}`, "error");
    } finally {
      setCreatingVariant(false);
    }
  }

  function requestDelete(file: ResumeFile) {
    if (!config || file.is_master) return;
    setPendingDelete(file);
  }

  async function confirmDelete() {
    const file = pendingDelete;
    if (!config || !file || file.is_master) return;
    setDeleting(true);
    try {
      await api.deleteVariant(config.resume_dir, file.name, config.build_dir);
      const list = await api.listResumes(config.resume_dir);
      setFiles(list);
      if (activeFile?.typ_path === file.typ_path) {
        const next = list.find((f) => f.is_master) ?? list[0] ?? null;
        if (next) {
          await openFile(next, config);
        } else {
          setActiveFile(null);
          setSavedContent("");
          setContent("");
          setPdfCacheKey(null);
        }
      }
      pushToast(`Deleted ${file.name}`);
      setPendingDelete(null);
    } catch (e) {
      pushToast(`Delete failed: ${e}`, "error");
    } finally {
      setDeleting(false);
    }
  }

  function handleNewVariant() {
    if (dirty) {
      setConfirmPrompt({
        title: "Unsaved changes",
        message: `"${activeFile?.name}" has unsaved changes. They'll be included in the new variant if you pick "Current file".`,
        confirmLabel: "Continue",
        action: () => setNewVariantOpen(true),
      });
      return;
    }
    setNewVariantOpen(true);
  }

  async function handleSettingsSaved(next: Config) {
    setConfig(next);
    try {
      const list = await api.listResumes(next.resume_dir);
      setFiles(list);
    } catch (e) {
      pushToast(`Refresh files failed: ${e}`, "error");
    }
  }

  const pdfPath =
    activeFile && config ? pdfPathFor(activeFile, config.build_dir) : null;

  // Build the upload preview content lazily — for structured docs we want plain text
  const [uploadPreview, setUploadPreview] = useState<string>("");
  useEffect(() => {
    if (!uploadOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await uploadPayload();
        if (!cancelled) setUploadPreview(t);
      } catch (e) {
        if (!cancelled) setUploadPreview(`Failed to render: ${e}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadOpen, content, isStructured]);

  return (
    <div className="app">
      <Toolbar
        dirty={dirty}
        compiling={compiling}
        hasFile={!!activeFile}
        hasPdf={pdfPath !== null && pdfCacheKey !== null}
        onSave={save}
        onCompile={compile}
        onOpenInPreview={openInPreview}
        onUpload={() => setUploadOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="app__body">
        <FileTree
          files={files}
          activePath={activeFile?.typ_path ?? null}
          dirty={dirty}
          onSelect={handleSelect}
          onNewVariant={handleNewVariant}
          onDelete={requestDelete}
        />

        <main className="app__main">
          <div className="editor">
            {activeFile && isStructured ? (
              <StructuredEditor
                key={activeFile.typ_path}
                initialJson={savedContent}
                onChange={setContent}
                onSave={save}
                onCompile={compile}
              />
            ) : (
              <Editor
                value={content}
                onChange={setContent}
                onSave={save}
                onCompile={compile}
              />
            )}
          </div>
          <PdfPreview pdfPath={pdfPath} cacheKey={pdfCacheKey} />
        </main>
      </div>

      {activeFile && (
        <UploadDialog
          open={uploadOpen}
          defaultName={defaultUploadName(activeFile)}
          defaultActivate={activeFile.is_master}
          content={uploadPreview}
          uploading={uploading}
          onClose={() => setUploadOpen(false)}
          onSubmit={submitUpload}
        />
      )}

      <NewVariantDialog
        open={newVariantOpen}
        hasMaster={files.some((f) => f.is_master && !!f.json_path)}
        currentFileName={activeFile?.name ?? null}
        currentIsStructured={isStructured}
        creating={creatingVariant}
        onClose={() => setNewVariantOpen(false)}
        onSubmit={createVariant}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        message="This removes its source files and built PDF, and cannot be undone."
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={confirmPrompt !== null}
        title={confirmPrompt?.title ?? ""}
        message={confirmPrompt?.message ?? ""}
        confirmLabel={confirmPrompt?.confirmLabel ?? "Continue"}
        danger={confirmPrompt?.confirmLabel === "Discard"}
        onCancel={() => setConfirmPrompt(null)}
        onConfirm={() => {
          const action = confirmPrompt?.action;
          setConfirmPrompt(null);
          action?.();
        }}
      />

      {config && (
        <SettingsDialog
          open={settingsOpen}
          config={config}
          onClose={() => setSettingsOpen(false)}
          onSaved={handleSettingsSaved}
          onToast={pushToast}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
