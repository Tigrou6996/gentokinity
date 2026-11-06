
import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getCareerAdvice = async (userInput: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: userInput,
      config: {
        systemInstruction: `Sei un consulente di carriera esperto per "LBS Lavoro Business in Germania". Il tuo compito è aiutare i candidati italiani a capire come trasferirsi e lavorare in Germania. 
        Sii professionale, incoraggiante e informativo. Parla dei vantaggi (stipendi, welfare) e delle sfide (lingua, burocrazia). 
        Rispondi sempre in italiano. Se l'utente chiede informazioni specifiche, menziona che offriamo supporto completo per documenti e alloggio e invita l'utente a cliccare sul pulsante "PARLA CON UN ESPERTO REALE" per accedere ai nostri contatti diretti (Telefono e WhatsApp).`,
        temperature: 0.7,
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return "Mi dispiace, al momento il mio modulo di intelligenza artificiale non è disponibile. Puoi contattare direttamente il nostro team via WhatsApp nella sezione contatti!";
  }
};
