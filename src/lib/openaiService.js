import { supabase } from './customSupabaseClient';

/**
 * Sends an image file to the 'analyze-invoice' Edge Function for processing.
 * @param {File} file - The image file to analyze.
 * @returns {Promise<Object>} - The extracted data from the invoice.
 */
export async function analyzeInvoice(file) {
  try {
    // Helper to convert File to Base64 string
    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const base64Image = await toBase64(file);

    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('analyze-invoice', {
      body: { image: base64Image }
    });

    if (error) {
      console.error('Supabase Function Error:', error);
      // Provide a user-friendly error message if possible
      throw new Error(error.message || 'Error de conexión con el servicio de análisis.');
    }

    return data;
  } catch (error) {
    console.error('Analysis Service Error:', error);
    throw error;
  }
}