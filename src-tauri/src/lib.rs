use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

const KEYRING_SERVICE: &str = "resume-studio";
const KEYRING_ACCOUNT: &str = "dworks-upload-token";

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub resume_dir: String,
    pub build_dir: String,
    pub dworks_upload_url: String,
    pub typst_path: String,
}

impl Default for Config {
    fn default() -> Self {
        // Generic first-run defaults; overridden by the user's saved config.json.
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let resume_dir = home.join("Documents").join("Resume").join("typst");
        let build_dir = resume_dir.join("build");
        Self {
            resume_dir: resume_dir.to_string_lossy().into_owned(),
            build_dir: build_dir.to_string_lossy().into_owned(),
            dworks_upload_url: "http://localhost:3000/api/resumes".into(),
            typst_path: "/opt/homebrew/bin/typst".into(),
        }
    }
}

#[derive(Serialize)]
pub struct ResumeFile {
    pub name: String,
    pub typ_path: String,
    pub json_path: Option<String>,
    pub is_master: bool,
}

#[derive(Serialize)]
pub struct UploadResult {
    pub ok: bool,
    pub status: u16,
    pub body: String,
}

fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("resume-studio")
        .join("config.json")
}

#[tauri::command]
fn get_config() -> Result<Config, String> {
    let path = config_path();
    if !path.exists() {
        return Ok(Config::default());
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_config(config: Config) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

fn is_typ(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()) == Some("typ")
}

fn is_json(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()) == Some("json")
}

fn collect_dir(dir: &Path, is_master: bool, out: &mut Vec<ResumeFile>) -> Result<(), String> {
    if !dir.is_dir() {
        return Ok(());
    }

    let entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .collect();

    let json_stems: std::collections::HashSet<String> = entries
        .iter()
        .filter(|p| is_json(p))
        .filter_map(|p| p.file_stem().map(|s| s.to_string_lossy().to_string()))
        .collect();

    for json_path in entries.iter().filter(|p| is_json(p)) {
        let stem = json_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let typ_path = json_path.with_extension("typ");
        out.push(ResumeFile {
            name: stem,
            typ_path: typ_path.to_string_lossy().to_string(),
            json_path: Some(json_path.to_string_lossy().to_string()),
            is_master,
        });
    }

    for typ_path in entries.iter().filter(|p| is_typ(p)) {
        let stem = typ_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
        if json_stems.contains(&stem) {
            continue;
        }
        out.push(ResumeFile {
            name: stem,
            typ_path: typ_path.to_string_lossy().to_string(),
            json_path: None,
            is_master,
        });
    }

    Ok(())
}

#[tauri::command]
fn list_resumes(resume_dir: String) -> Result<Vec<ResumeFile>, String> {
    let root = Path::new(&resume_dir);
    if !root.is_dir() {
        return Err(format!("not a directory: {}", resume_dir));
    }

    let mut out: Vec<ResumeFile> = Vec::new();
    collect_dir(root, true, &mut out)?;
    collect_dir(&root.join("applications"), false, &mut out)?;
    out.sort_by(|a, b| (!a.is_master).cmp(&!b.is_master).then(a.name.cmp(&b.name)));
    Ok(out)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_variant(
    resume_dir: String,
    slug: String,
    json_content: String,
) -> Result<ResumeFile, String> {
    let slug = slug.trim();
    if slug.is_empty() {
        return Err("filename is required".into());
    }
    if !slug
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("filename may only contain letters, numbers, '-', and '_'".into());
    }

    let apps = Path::new(&resume_dir).join("applications");
    fs::create_dir_all(&apps).map_err(|e| e.to_string())?;

    let json_path = apps.join(format!("{}.json", slug));
    let typ_path = apps.join(format!("{}.typ", slug));
    if json_path.exists() {
        return Err(format!("{} already exists", json_path.display()));
    }
    if typ_path.exists() {
        return Err(format!("{} already exists", typ_path.display()));
    }

    fs::write(&json_path, &json_content).map_err(|e| e.to_string())?;
    let driver = format!(
        "#import \"../template.typ\": resume\n#resume(json(\"{}.json\"))\n",
        slug
    );
    fs::write(&typ_path, driver).map_err(|e| e.to_string())?;

    Ok(ResumeFile {
        name: slug.to_string(),
        typ_path: typ_path.to_string_lossy().to_string(),
        json_path: Some(json_path.to_string_lossy().to_string()),
        is_master: false,
    })
}

#[tauri::command]
fn delete_variant(resume_dir: String, name: String, build_dir: String) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("name is required".into());
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("name may only contain letters, numbers, '-', and '_'".into());
    }

    // Only ever touch files under applications/ — masters live at the root and
    // are never addressable here.
    let apps = Path::new(&resume_dir).join("applications");
    let json_path = apps.join(format!("{}.json", name));
    let typ_path = apps.join(format!("{}.typ", name));
    let pdf_path = Path::new(&build_dir).join(format!("{}.pdf", name));

    if !json_path.exists() && !typ_path.exists() {
        return Err(format!("no variant named '{}' found", name));
    }

    for p in [&json_path, &typ_path, &pdf_path] {
        if p.exists() {
            fs::remove_file(p)
                .map_err(|e| format!("failed to delete {}: {}", p.display(), e))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn compile_typst(
    typst_path: String,
    root: String,
    input: String,
    output: String,
) -> Result<String, String> {
    if let Some(parent) = Path::new(&output).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let out = Command::new(&typst_path)
        .args(["compile", "--root", &root, &input, &output])
        .output()
        .map_err(|e| format!("failed to spawn typst at {}: {}", typst_path, e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("typst compile failed: {}", stderr.trim()));
    }

    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    Ok(stderr.trim().to_string())
}

#[derive(Deserialize)]
struct ResumeData {
    name: String,
    headline: String,
    email: String,
    sections: Vec<ResumeSection>,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum ResumeSection {
    Summary { bullets: Vec<String> },
    Skills { groups: Vec<SkillGroup> },
    Experience { jobs: Vec<Job> },
    Certifications { items: Vec<String> },
    Education { schools: Vec<School> },
}

#[derive(Deserialize)]
struct SkillGroup {
    label: String,
    items: String,
}

#[derive(Deserialize)]
struct Job {
    company: String,
    role: String,
    dates: String,
    summary: String,
    #[serde(default)]
    bullets: Vec<String>,
    #[serde(default)]
    highlight: Option<Highlight>,
}

#[derive(Deserialize)]
struct Highlight {
    label: String,
    text: String,
}

#[derive(Deserialize)]
struct School {
    name: String,
    degree: String,
}

#[tauri::command]
fn render_resume_text(json_content: String) -> Result<String, String> {
    let data: ResumeData =
        serde_json::from_str(&json_content).map_err(|e| format!("invalid resume JSON: {}", e))?;

    let mut out = String::new();
    out.push_str(&data.name);
    out.push('\n');
    out.push_str(&data.headline);
    out.push('\n');
    out.push_str(&data.email);
    out.push_str("\n\n");

    for section in &data.sections {
        match section {
            ResumeSection::Summary { bullets } => {
                out.push_str("SUMMARY\n");
                for b in bullets {
                    out.push_str("- ");
                    out.push_str(b);
                    out.push('\n');
                }
            }
            ResumeSection::Skills { groups } => {
                out.push_str("\nSKILLS\n");
                for g in groups {
                    out.push_str(&g.label);
                    out.push_str(": ");
                    out.push_str(&g.items);
                    out.push('\n');
                }
            }
            ResumeSection::Experience { jobs } => {
                out.push_str("\nEXPERIENCE\n");
                for (i, j) in jobs.iter().enumerate() {
                    if i > 0 {
                        out.push('\n');
                    }
                    out.push_str(&j.company);
                    out.push_str(" — ");
                    out.push_str(&j.role);
                    out.push('\n');
                    out.push_str(&j.dates);
                    out.push('\n');
                    out.push_str(&j.summary);
                    out.push('\n');
                    if !j.bullets.is_empty() {
                        out.push('\n');
                        for b in &j.bullets {
                            out.push_str("- ");
                            out.push_str(b);
                            out.push('\n');
                        }
                    }
                    if let Some(h) = &j.highlight {
                        out.push('\n');
                        out.push_str(&h.label);
                        out.push_str(" — ");
                        out.push_str(&h.text);
                        out.push('\n');
                    }
                }
            }
            ResumeSection::Certifications { items } => {
                out.push_str("\nCERTIFICATIONS\n");
                for c in items {
                    out.push_str("- ");
                    out.push_str(c);
                    out.push('\n');
                }
            }
            ResumeSection::Education { schools } => {
                out.push_str("\nEDUCATION\n");
                for s in schools {
                    out.push_str(&s.name);
                    out.push_str(" — ");
                    out.push_str(&s.degree);
                    out.push('\n');
                }
            }
        }
    }

    Ok(out)
}

#[tauri::command]
fn file_mtime(path: String) -> Result<u64, String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = meta.modified().map_err(|e| e.to_string())?;
    let secs = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    Ok(secs)
}

#[tauri::command]
fn open_in_preview(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_token(token: String) -> Result<(), String> {
    let entry = keyring_entry()?;
    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
fn has_token() -> bool {
    keyring_entry()
        .and_then(|e| e.get_password().map_err(|e| e.to_string()))
        .is_ok()
}

#[tauri::command]
fn clear_token() -> Result<(), String> {
    let entry = keyring_entry()?;
    entry.delete_credential().map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct UploadBody<'a> {
    name: &'a str,
    content: &'a str,
    activate: bool,
}

#[tauri::command]
async fn upload_to_dworks(
    url: String,
    name: String,
    content: String,
    activate: bool,
) -> Result<UploadResult, String> {
    let entry = keyring_entry()?;
    let token = entry
        .get_password()
        .map_err(|e| format!("no upload token saved: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let body = UploadBody {
        name: &name,
        content: &content,
        activate,
    };

    let resp = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let body_text = resp.text().await.unwrap_or_default();

    Ok(UploadResult {
        ok,
        status,
        body: body_text,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_resumes,
            read_file,
            write_file,
            create_variant,
            delete_variant,
            compile_typst,
            render_resume_text,
            file_mtime,
            open_in_preview,
            save_token,
            has_token,
            clear_token,
            upload_to_dworks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
