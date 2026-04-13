import Groq from "groq-sdk";

const apiKey = import.meta.env.VITE_GROQ_API_KEY;

// Initialize Groq client
// dangerouslyAllowBrowser is required to run in the browser (client-side)
const groq = apiKey ? new Groq({ apiKey, dangerouslyAllowBrowser: true }) : null;

export interface AITask {
  title: string;
  category: string;
}

export const generateTasksWithAI = async (prompt: string): Promise<AITask[]> => {
  if (!groq) {
    throw new Error("Chave da API da Groq não encontrada. Configure VITE_GROQ_API_KEY nas variáveis de ambiente.");
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você é um assistente de produtividade. O usuário pedirá ajuda para organizar tarefas ou rotinas. Analise o pedido e retorne APENAS um JSON no formato: { \"tasks\": [ { \"title\": \"Nome da tarefa\", \"category\": \"Categoria (ex: Limpeza, Trabalho, Pessoal, Saúde, etc)\" } ] }. Não inclua nenhum outro texto, apenas o JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.tasks || [];
  } catch (error) {
    console.error("Erro ao gerar tarefas com IA:", error);
    throw error;
  }
};
