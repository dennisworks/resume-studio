import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export interface Config {
  resume_dir: string;
  build_dir: string;
  dworks_upload_url: string;
  typst_path: string;
}

export interface ResumeFile {
  name: string;
  typ_path: string;
  json_path: string | null;
  is_master: boolean;
}

export interface UploadResult {
  ok: boolean;
  status: number;
  body: string;
}

export const api = {
  getConfig: () => invoke<Config>("get_config"),
  saveConfig: (config: Config) => invoke<void>("save_config", { config }),
  listResumes: (resumeDir: string) =>
    invoke<ResumeFile[]>("list_resumes", { resumeDir }),
  readFile: (path: string) => invoke<string>("read_file", { path }),
  writeFile: (path: string, content: string) =>
    invoke<void>("write_file", { path, content }),
  createVariant: (resumeDir: string, slug: string, jsonContent: string) =>
    invoke<ResumeFile>("create_variant", { resumeDir, slug, jsonContent }),
  deleteVariant: (resumeDir: string, name: string, buildDir: string) =>
    invoke<void>("delete_variant", { resumeDir, name, buildDir }),
  compileTypst: (typstPath: string, root: string, input: string, output: string) =>
    invoke<string>("compile_typst", { typstPath, root, input, output }),
  renderResumeText: (jsonContent: string) =>
    invoke<string>("render_resume_text", { jsonContent }),
  fileMtime: (path: string) => invoke<number>("file_mtime", { path }),
  openInPreview: (path: string) => invoke<void>("open_in_preview", { path }),
  saveToken: (token: string) => invoke<void>("save_token", { token }),
  hasToken: () => invoke<boolean>("has_token"),
  clearToken: () => invoke<void>("clear_token"),
  uploadToDworks: (
    url: string,
    name: string,
    content: string,
    activate: boolean,
  ) =>
    invoke<UploadResult>("upload_to_dworks", { url, name, content, activate }),
};

export { convertFileSrc };

export function pdfPathFor(file: ResumeFile, buildDir: string): string {
  return `${buildDir}/${file.name}.pdf`;
}

export function defaultUploadName(file: ResumeFile): string {
  if (file.is_master) return "Master";
  return file.name
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ---------- Resume data model (matches template.typ schema) ----------

export interface ResumeData {
  name: string;
  headline: string;
  email: string;
  sections: Section[];
}

export type Section =
  | { kind: "summary"; bullets: string[] }
  | { kind: "skills"; groups: SkillGroup[] }
  | { kind: "experience"; jobs: Job[] }
  | { kind: "certifications"; items: string[] }
  | { kind: "education"; schools: School[] };

export interface SkillGroup {
  label: string;
  items: string;
}

export interface Job {
  company: string;
  role: string;
  dates: string;
  summary: string;
  bullets?: string[];
  highlight?: { label: string; text: string };
}

export interface School {
  name: string;
  degree: string;
}

export const SECTION_KINDS: Section["kind"][] = [
  "summary",
  "skills",
  "experience",
  "certifications",
  "education",
];

export function emptyResume(): ResumeData {
  return {
    name: "",
    headline: "",
    email: "",
    sections: [],
  };
}

export function emptySection(kind: Section["kind"]): Section {
  switch (kind) {
    case "summary":
      return { kind, bullets: [""] };
    case "skills":
      return { kind, groups: [{ label: "", items: "" }] };
    case "experience":
      return {
        kind,
        jobs: [{ company: "", role: "", dates: "", summary: "", bullets: [""] }],
      };
    case "certifications":
      return { kind, items: [""] };
    case "education":
      return { kind, schools: [{ name: "", degree: "" }] };
  }
}

export function stringifyResume(data: ResumeData): string {
  return JSON.stringify(data, null, 2) + "\n";
}
