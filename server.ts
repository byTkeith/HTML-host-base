import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API route to get the raw HTML
  app.get("/view/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!/^[a-zA-Z0-9_\-]+$/.test(id)) {
        res.status(400).send("Invalid ID");
        return;
      }
      
      const { projectId, firestoreDatabaseId } = firebaseConfig;
      
      const apiUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/htmlFiles/${id}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          res.status(404).send("File not found");
        } else {
          res.status(500).send("Error fetching file");
        }
        return;
      }
      
      const data = await response.json();
      
      if (data && data.fields && data.fields.content && data.fields.content.stringValue) {
        // We only want the raw HTML string
        const htmlContent = data.fields.content.stringValue;
        res.type('text/html');
        res.send(htmlContent);
      } else {
        res.status(404).send("File content is missing or invalid");
      }
      
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
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
