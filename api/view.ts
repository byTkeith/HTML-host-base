import type { VercelRequest, VercelResponse } from '@vercel/node';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = req.query.id as string;
    
    if (!id || !/^[a-zA-Z0-9_\\-]+$/.test(id)) {
      return res.status(400).send("Invalid ID");
    }
    
    const { projectId, firestoreDatabaseId } = firebaseConfig;
    
    // We fetch directly from the Firestore REST API to avoid bundling issues with the full SDK in serverless
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
    
    if (data && data.fields && data.fields.content && data.fields.content.stringValue) {
      const htmlContent = data.fields.content.stringValue;
      // Vercel serverless functions require explicit headers
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlContent);
    } else {
      return res.status(404).send("File content is missing or invalid");
    }
    
  } catch (error) {
    console.error(error);
    return res.status(500).send("Server error");
  }
}
