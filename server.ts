import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/backup-json", (req, res) => {
    const backup: Record<string, string> = {};
    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(process.cwd(), fullPath);
        if (
          relativePath.startsWith("node_modules") || 
          relativePath.startsWith("dist") || 
          relativePath.startsWith(".git") || 
          relativePath.startsWith("dev-dist") || 
          relativePath.endsWith(".zip") ||
          relativePath.endsWith(".png") ||
          relativePath.endsWith(".jpg") ||
          relativePath.endsWith(".ico")
        ) continue;

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else backup[relativePath] = fs.readFileSync(fullPath, 'utf8');
      }
    };
    try {
      walk(process.cwd());
      res.json(backup);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/backup-code", (req, res) => {
    try {
      const zip = new AdmZip();
      const rootDir = process.cwd();
      
      const walk = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const relativePath = path.relative(rootDir, fullPath);
          
          if (
            relativePath.startsWith("node_modules") || 
            relativePath.startsWith("dist") || 
            relativePath.startsWith(".git") || 
            relativePath.startsWith("dev-dist") || 
            relativePath.endsWith(".zip")
          ) {
            continue;
          }

          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else {
            zip.addLocalFile(fullPath, path.dirname(relativePath) === "." ? "" : path.dirname(relativePath));
          }
        }
      };

      walk(rootDir);
      
      const buffer = zip.toBuffer();
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=RF_Suite_Source.zip');
      res.send(buffer);
    } catch (err) {
      console.error("Zip error:", err);
      res.status(500).send("Error creating zip: " + String(err));
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
