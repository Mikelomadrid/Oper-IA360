import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/lib/customSupabaseClient';

// Ensure the worker is configured correctly from a CDN to avoid build issues in some environments
// We use the version from the imported library to match
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

/**
 * Extracts text from the first few pages of a PDF file.
 * @param {File} file - The PDF file.
 * @returns {Promise<string>} - Extracted text.
 */
export const extractTextFromPdf = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        // Limit to first 3 pages to avoid excessive tokens/time
        const maxPages = Math.min(pdf.numPages, 3);
        
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n`;
        }
        
        return fullText;
    } catch (error) {
        console.error("Error extracting PDF text:", error);
        throw new Error("No se pudo leer el archivo PDF.");
    }
};

/**
 * Converts a file to Base64 string.
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

/**
 * Sends content to the analyze-contract edge function.
 * @param {File} file - The file to analyze (PDF or Image)
 * @returns {Promise<Object>} - Extracted data
 */
export const analyzeContractFile = async (file) => {
    let payload = {};

    try {
        if (file.type === 'application/pdf') {
            const text = await extractTextFromPdf(file);
            payload = { content: text, type: 'text' };
        } else if (file.type.startsWith('image/')) {
            const base64 = await fileToBase64(file);
            payload = { content: base64, type: 'image' };
        } else {
            throw new Error("Formato de archivo no soportado. Use PDF o Imagen.");
        }

        console.log("Sending payload to analyze-contract:", { type: payload.type, contentLength: payload.content.length });

        const { data, error } = await supabase.functions.invoke('analyze-contract', {
            body: payload
        });

        if (error) {
            console.error("Supabase Function Error:", error);
            // Try to parse error message if available
            let msg = error.message;
            try {
                 // sometimes supabase returns a JSON in message
                 const parsed = JSON.parse(msg);
                 if(parsed.error) msg = parsed.error;
            } catch(e) {}
            throw new Error(`Error en el análisis IA: ${msg}`);
        }

        console.log("Received data from analyze-contract:", data);
        return data;

    } catch (err) {
        console.error("Error in analyzeContractFile:", err);
        throw err;
    }
};