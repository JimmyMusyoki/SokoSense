
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // KilimoSTAT Proxy
  app.get("/api/kilimo/*", async (req, res) => {
    let subPath = req.params[0];
    
    // Ensure subPath ends with a slash if it doesn't have one, as the Kilimo API expects it
    // But don't add it if it's just an empty string or already has one
    if (subPath && !subPath.endsWith('/')) {
      subPath += '/';
    }
    
    const query = new URLSearchParams(req.query as any).toString();
    let baseUrl = (process.env.KILIMO_API_BASE_URL || 'https://statistics.kilimo.go.ke/api').trim();
    
    // Safety check: if baseUrl is just a port or invalid, use the default
    if (!baseUrl.startsWith('http')) {
      console.warn(`Invalid KILIMO_API_BASE_URL: ${baseUrl}. Using default.`);
      baseUrl = 'https://statistics.kilimo.go.ke/api';
    }
    
    // Remove trailing slash from baseUrl to avoid double slashes
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    const url = `${baseUrl}/${subPath}${query ? '?' + query : ''}`;
    
    console.log(`Proxying request to: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Kilimo API returned ${response.status}` });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Failed to fetch from Kilimo API" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
