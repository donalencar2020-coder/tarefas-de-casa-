import Groq from "groq-sdk";

const apiKey = process.env.VITE_GROQ_API_KEY;
console.log("API Key exists in env:", !!apiKey);

if (!apiKey) {
  console.error("Error: VITE_GROQ_API_KEY is not set in the environment.");
  process.exit(1);
}

const groq = new Groq({ apiKey });

async function runTest() {
  try {
    console.log("Testing Groq API...");
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Retorne apenas um JSON válido."
        },
        {
          role: "user",
          content: "Crie 1 tarefa de teste. Formato: { \"tasks\": [ { \"title\": \"Teste\", \"category\": \"Geral\" } ] }"
        }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });
    console.log("Success! Response:");
    console.log(completion.choices[0]?.message?.content);
  } catch (error: any) {
    console.error("Failed to connect to Groq API:");
    console.error(error.message || error);
  }
}

runTest();
