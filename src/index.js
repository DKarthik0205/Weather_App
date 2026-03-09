const express = require("express");
const hbs = require("hbs");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

const publicPath = path.join(__dirname, "../public");
const viewsPath = path.join(__dirname, "../templates/views");
const partialsPath = path.join(__dirname, "../templates/partials");
const dataDir = path.join(__dirname, "../data");
const templatePath = path.join(dataDir, "employee-allocation-template.csv");
const consolidatedPath = path.join(dataDir, "consolidated-report.csv");
const submissionsPath = path.join(dataDir, "submissions.json");

const REQUIRED_HEADERS = ["#", "Name", "Monthly Capacity (hrs)", "Project 1", "Planned Enhancement Hours", "Planned Production Issues Hours", "Project 2", "Planned Enhancement Hours", "Planned Production Issues Hours", "Project 3", "Planned Enhancement Hours", "Planned Production Issues Hours", "Project 4", "Planned Enhancement Hours", "Planned Production Issues Hours", "Project 5", "Planned Enhancement Hours", "Planned Production Issues Hours", "Project 6", "Planned Enhancement Hours", "Planned Production Issues Hours", "Planned Billable Hour", "Total Planned Hours", "Learning / Logic Exploration", "Internal Calls", "WSR Support", "Non-Billable Hours", "Adhoc Project Allocation", "Total Actual Billable Hours", "Leakage Hours", "Leakage %", "Reason"];

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

function parseCsv(content) {
  return content.replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0).map(parseCsvLine);
}

function createTemplate() {
  if (!fs.existsSync(templatePath)) fs.writeFileSync(templatePath, `${REQUIRED_HEADERS.join(",")}\n`);
}

function readSubmissions() {
  if (!fs.existsSync(submissionsPath)) return [];
  return JSON.parse(fs.readFileSync(submissionsPath, "utf-8"));
}

function writeSubmissions(submissions) {
  fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));
}

function createConsolidatedReport(submissions) {
  const rows = [REQUIRED_HEADERS];
  submissions.forEach((s) => s.rows.forEach((r) => rows.push(r)));
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  fs.writeFileSync(consolidatedPath, csv);
}

function validateAndParse(content) {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new Error("No employee data rows found in file.");
  const headers = rows[0].slice(0, REQUIRED_HEADERS.length).map((h) => String(h).trim());
  const exactHeader = REQUIRED_HEADERS.every((h, i) => headers[i] === h);
  if (!exactHeader) throw new Error("Invalid template format. Please use the downloaded template without modifying headers.");

  const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== "")).map((r) => {
    const padded = [...r];
    while (padded.length < REQUIRED_HEADERS.length) padded.push("");
    return padded.slice(0, REQUIRED_HEADERS.length);
  });

  dataRows.forEach((r, idx) => {
    if (!String(r[1]).trim() || !String(r[2]).trim()) throw new Error(`Row ${idx + 2}: Name and Monthly Capacity (hrs) are mandatory.`);
  });

  return dataRows;
}

createTemplate();
if (!fs.existsSync(consolidatedPath)) createConsolidatedReport([]);

app.set("view engine", "hbs");
app.set("views", viewsPath);
hbs.registerPartials(partialsPath);
app.use(express.static(publicPath));
app.use(express.json({ limit: "5mb" }));

app.get("/", (req, res) => res.render("index", { title: "Work Allocation Consolidation" }));
app.get("/template/download", (req, res) => res.download(templatePath));
app.get("/submit", (req, res) => res.render("submit", { title: "Submit Monthly Allocation" }));

app.post("/submit", (req, res) => {
  const { fileName, content } = req.body;
  if (!fileName || !content) return res.status(400).json({ ok: false, message: "Please upload a CSV file created from the template." });
  try {
    const rows = validateAndParse(content);
    const submissions = readSubmissions();
    submissions.push({ id: `${Date.now()}`, fileName, submittedAt: new Date().toISOString(), rows });
    writeSubmissions(submissions);
    createConsolidatedReport(submissions);
    res.json({ ok: true, message: `Submission successful. ${rows.length} employee record(s) processed.` });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.get("/admin", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const project = String(req.query.project || "").toLowerCase();
  const submissions = readSubmissions();
  const records = submissions.flatMap((s) => s.rows.map((r) => ({
    name: r[1], monthlyCapacity: r[2], totalPlanned: r[22], totalBillable: r[28], leakageHours: r[29], leakagePercentage: r[30], reason: r[31],
    projects: [r[3], r[6], r[9], r[12], r[15], r[18]].join(", "), submittedAt: s.submittedAt, fileName: s.fileName,
  })));

  const filtered = records.filter((record) => {
    const nameOk = !search || String(record.name).toLowerCase().includes(search);
    const projOk = !project || String(record.projects).toLowerCase().includes(project);
    return nameOk && projOk;
  });

  res.render("admin", { title: "Admin Dashboard", submissions: filtered, search: req.query.search || "", project: req.query.project || "", totalFiles: submissions.length, totalEmployees: records.length });
});
app.get("/admin/download", (req, res) => res.download(consolidatedPath, "consolidated-work-allocation-report.csv"));
app.get("*", (req, res) => res.status(404).render("404", { title: "Page not found" }));

app.listen(port, () => console.log(`Server is listening on port ${port}`));
