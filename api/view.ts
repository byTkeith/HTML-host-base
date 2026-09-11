import type { VercelRequest, VercelResponse } from '@vercel/node';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = req.query.id as string;
    
    if (!id || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
      return res.status(400).send("Invalid ID");
    }
    
    const { projectId, firestoreDatabaseId } = firebaseConfig;
    
    const apiUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/htmlFiles/${id}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).send("File not found");
      } else {
        return res.status(500).send("Error fetching file");
      }
    }
    
    const data = await response.json();
    
    if (data && data.fields) {
      let rawContent = "";

      if (data.fields.content && data.fields.content.stringValue) {
        rawContent = data.fields.content.stringValue;
      } else if (data.fields.numChunks && data.fields.numChunks.integerValue) {
        const numChunks = parseInt(data.fields.numChunks.integerValue, 10);
        
        // Fast concurrent chunk retrieval
        const chunkPromises = Array.from({ length: numChunks }, async (_, i) => {
          const chunkUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/htmlFiles/${id}/chunks/${i}`;
          const chunkRes = await fetch(chunkUrl);
          if (!chunkRes.ok) {
            throw new Error(`Failed to load chunk ${i}`);
          }
          const chunkData = await chunkRes.json();
          return chunkData.fields?.content?.stringValue || "";
        });

        const chunkStrings = await Promise.all(chunkPromises);
        rawContent = chunkStrings.join("");
      }

      if (rawContent) {
        // If content is base64 gzip, stream it directly with Content-Encoding: gzip
        try {
          const buf = Buffer.from(rawContent, 'base64');
          if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Encoding', 'gzip');
            return res.status(200).send(buf);
          }
        } catch {
          // Fallback to plain text
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(rawContent);
      }
    }
    
    return res.status(404).send("File content is missing or invalid");
    
  } catch (error) {
    console.error(error);
    return res.status(500).send("Server error");
  }
}
