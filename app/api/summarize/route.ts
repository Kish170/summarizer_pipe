import { NextResponse } from "next/server";
import { ContentItem } from "@screenpipe/js";
import { embed } from "ai";
import { Note } from "@/lib/types";
import { pipe } from "@screenpipe/js";
import { ollama } from "ollama-ai-provider"; 
import { OpenAI } from "openai";

const embProvider = ollama.embedding("nomic-embed-text");

async function summarizeText(prompt: string): Promise<Note> {
  const set = await pipe.settings.getAll()
  const openai = new OpenAI({
    apiKey:
        set?.aiProviderType === "screenpipe-cloud"
        ? set?.user.token 
        : set?.openaiApiKey,
    baseURL: set?.aiUrl,
    dangerouslyAllowBrowser: true, 
  });
  const output = await openai.chat.completions.create({
    model: set.aiModel, // if user is using screenpipe-cloud, you can also use claude-3-7-sonnet or gemini-2.0-flash-lite
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that generates structured educational content in JSON format. When given a prompt, return a JSON object with the following structure:

        {
          "title": "Clear, topic-focused title",
          "content": "HTML-formatted educational content with proper structure",
          "tags": ["#relevant-topic", "#subject-area", "#learning-concept"]
        }

        Ensure the title is concise and topic-specific. The content should be well-structured HTML that is educational and informative. The tags should be relevant to the content, including the subject area and main learning concepts.`
      },
      {
        role: "user", 
        content: prompt
      }
    ]
  });


  if (!output.choices[0].message.content) {
    throw new Error("Failed to get content from the model response");
  }
  try {
    let content = output.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.slice(7, -3).trim();
    } else if (content.startsWith("```")) {
      content = content.slice(3, -3).trim(); 
    }
  
    const noteContent = JSON.parse(content);
    return noteContent as Note;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    throw new Error("Failed to parse JSON from model output");
  }
}

async function generateNote(
  content: string,
  model: string,
  startTime: Date,
  endTime: Date,
  tag: string
): Promise<Note> {

  const defaultPrompt = `You are analyzing notes that were created from OCR data
  
  Based on the following data, generate structured notes that summarizes all these notes with proper HTML formatting.

  Screen data: ${JSON.stringify(content)}
  
  Rules:
  - Create clear, educational notes with proper structure and hierarchy
  - Use appropriate HTML tags for formatting:
    - <h1> for main title
    - <h2>, <h3> for subtopics
    - <p> for paragraphs
    - <ul> and <li> for unordered lists
    - <ol> and <li> for ordered lists/steps
    - <code> for code snippets
    - <blockquote> for important quotes
    - <em> for emphasis
    - <strong> for important terms
  - Add relevant educational tags
  - Include key learning points and takeaways
  - Structure content for easy review and reference
  - Must return a JSON object

  Return a JSON object with:
  {
      "title": "Clear, topic-focused title",
      "content": "HTML-formatted educational content with proper structure",
      "tags": ["#relevant-topic", "#subject-area", "#learning-concept"]
  }`;

  try {
    const generatedText: Note = await summarizeText(defaultPrompt);
    console.log(generatedText);
    const formatDate = (date: Date) =>
      date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    return {
      ...generatedText,
      startTime: formatDate(startTime),
      endTime: formatDate(endTime),
    };
  } catch (error: any) {
    console.error("Screen Cloud generation error:", {
      message: error?.message,
      modelUsed: model,
      promptLength: defaultPrompt.length,
      timestamp: new Date().toISOString(),
    });

    if (error?.message?.includes("Headers Timeout")) {
      throw new Error(
        "Note generation timed out. The text might be too long or the model is busy."
      );
    }

    throw new Error(`Failed to generate note: ${error?.message || "Unknown error"}`);
  }
}
  
function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (normA * normB);
}


async function findTitle(titles: string[], tag: string): Promise<string> {
  let highestScore = 0;
  let bestTitle = "";
  const { embedding: promptEmbedding } = await embed({
    model: embProvider,
    value: tag,
  });

  for (const title of titles) {
    const { embedding: titleEmbedding } = await embed({
      model: embProvider,
      value: title,
    });
    const score = cosineSimilarity(promptEmbedding, titleEmbedding);
      if (score > highestScore) {
        highestScore = score;
        bestTitle = title;
    }
  }
  return bestTitle;
}

async function joinContents(contents: string[]): Promise<string> {
  return contents.join("\n\n");
}

function getTopTags(tags: string[], limit: number = 4): string[] {
  // Count frequency of each tag
  const tagFrequency = tags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sort tags by frequency and get top ones
  return Object.entries(tagFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tag]) => tag);
}

async function mergeNotes(notes: Note[], tag: string): Promise<Note> {
  if (notes.length === 0) {
    throw new Error("Cannot merge empty notes array");
  }

  const contents: string[] = [];
  const titles: string[] = [];
  const tags: string[] = [];

  // Get first note's startTime and last note's endTime
  const startTime = notes[0].startTime;
  const endTime = notes[notes.length - 1].endTime;

  for (const note of notes) {
    contents.push(note.content);
    titles.push(note.title);
    tags.push(...note.tags);
  }
  
  const title = await findTitle(titles, tag);
  const content = await joinContents(contents);
  const topTags = getTopTags(tags);
  
  return {
    title,
    content,
    tags: topTags,
    startTime,
    endTime
  };
}

async function processWithConcurrencyLimit(chunks:string[], model:string, startTime:Date, endTime:Date, tag:string, limit = 3):Promise<Note[]> {
  const results = [];
  for (let i = 0; i < chunks.length; i += limit) {
    const batch = chunks.slice(i, i + limit);
    const batchPromises = batch.map(chunk => 
      generateNote(chunk, model, startTime, endTime, tag)
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  return results;
}

function extractOCRText(items: ContentItem[]): string {
  return items
    .map(item => {
      if (item.type === "OCR" && item.content && typeof item.content === "object" && "text" in item.content) {
        return item.content.text;
      }
      return "";
    })
    .filter(text => text.trim().length > 0)
    .join("\n\n");
}

async function chunkOCRText(ocrText: string, chunkSize: number = 250000): Promise<string[]> {
  const words = ocrText.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const word of words) {
    if ((currentChunk.length + word.length) >= chunkSize) {
      chunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk += " " + word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startTime, endTime, tag, taggedNotes } = body;

    const csettings = await pipe.settings.getAll();
    const model = csettings.aiModel;

    const chunks = await chunkOCRText(taggedNotes);

    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    const notes = await processWithConcurrencyLimit(
      chunks, 
      model, 
      startTimeDate, 
      endTimeDate, 
      tag,
      3  
    );

    if (notes.length === 0) {
      return NextResponse.json({ error: "Failed to generate any notes" }, { status: 400 });
    }

    const mergedNote = notes.length === 1 ? notes[0] : await mergeNotes(notes, tag);

    return NextResponse.json({ note: mergedNote })
  } catch (error) {
    console.error("error generating work log:", error);
    return NextResponse.json({ error: "error generating work log" }, { status: 500 });
  }
}