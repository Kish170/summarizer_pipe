import { NextResponse } from "next/server";
import { ContentItem } from "@screenpipe/js";
import { embed, generateObject } from "ai";
import { ollama } from "ollama-ai-provider";
import { z } from "zod";
import { Note } from "@/lib/types";
import { pipe } from "@screenpipe/js";
import fs from 'fs/promises';


const note = z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string())
});
const embProvider = ollama.embedding("nomic-embed-text");

async function cleanOCRText(ocrText: string): Promise<string> {
  const stopwords = await fs.readFile('lib/stopwords.txt', 'utf-8');
  const stopwordsArray = new Set(stopwords.split('\n').map(word => word.trim().toLowerCase()).filter(Boolean)); 

  return ocrText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") 
    .trim()
    .split(/\s+/) 
    .filter(word => !stopwordsArray.has(word)) 
    .join(" "); 
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

async function chunkOCRText(ocrText: string, chunkSize: number = 1024): Promise<string[]> {
  const words = ocrText.split(/\s+/); 
  const chunks: string[] = [];

  let currentChunk: string[] = [];
  
  for (const word of words) {
    if (currentChunk.length < chunkSize) {
      currentChunk.push(word);
    } else {
      chunks.push(currentChunk.join(" "));
      currentChunk = [word];
    }
  }

  if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
  return chunks;
}



async function generateNote(
    screenData: string,
    model: string,
    startTime: Date,
    endTime: Date,
    customPrompt: string,
  ): Promise<Note> {
  
    const defaultPrompt = `Create notes from this screen recording text that are relevant to the user's prompt: 
    
    ${screenData}

    Instructions: ${customPrompt} 

    Return JSON: {"title": "brief title", "content": "use <h1>,<h2>,<p>,<ul>,<li>,<code>,<em>,<strong>, [[concept]]", "tags": ["#tags"]}`;
  
    const provider = ollama(model);

    try {
      const response = await generateObject({
        model: provider,
        messages: [{ role: "user", content: defaultPrompt }],
        schema: note,
      });

      return {
        ...response.object,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
    } catch (error: any) {
      console.error('LLM generation error details:', {
        message: error?.message,
        modelUsed: model,
        promptLength: defaultPrompt.length,
        timestamp: new Date().toISOString()
      });
      
      if (error?.message?.includes('Headers Timeout')) {
        throw new Error('Note generation timed out. The text might be too long or the model is busy.');
      }
      
      throw new Error(`Failed to generate note: ${error?.message || 'Unknown error'}`);
    }
}

async function findTitle(titles: string[], customPrompt: string): Promise<string> {
  let highestScore = 0;
  let bestTitle = "";
  const { embedding: promptEmbedding } = await embed({
    model: embProvider,
    value: customPrompt,
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

async function mergeNotes(notes: Note[], customPrompt: string): Promise<Note> {
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
  
  const title = await findTitle(titles, customPrompt);
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

async function deduplicateScreenData(
    screenData: ContentItem[]
  ): Promise<ContentItem[]> {
    if (!screenData.length) return screenData;
  
    try {
      const embeddings: number[][] = [];
      const uniqueData: ContentItem[] = [];
      let duplicatesRemoved = 0;
  
      for (const item of screenData) {
        const textToEmbed =
          "content" in item
            ? typeof item.content === "string"
              ? item.content
              : "text" in item.content
              ? item.content.text
              : JSON.stringify(item.content)
            : "";
  
        if (!textToEmbed.trim()) {
            uniqueData.push(item);
            continue;
        }
  
        try {
            const { embedding } = await embed({
                model: embProvider,
                value: textToEmbed,
            });
    
            let isDuplicate = false;
            for (let i = 0; i < embeddings.length; i++) {
                const similarity = cosineSimilarity(embedding, embeddings[i]);
                if (similarity > 0.95) {
                isDuplicate = true;
                duplicatesRemoved++;
                break;
                }
            }
    
            if (!isDuplicate) {
                embeddings.push(embedding);
                uniqueData.push(item);
            }
            } catch (error) {
                console.warn("embedding failed for item, keeping it:", error);
                uniqueData.push(item);
            }
        }
    
        console.log(
            `deduplication: removed ${duplicatesRemoved} duplicates from ${screenData.length} items`
        );
      return uniqueData;
    } catch (error) {
        console.warn("deduplication failed, using original data:", error);
        return screenData;
    }
}
  
function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (normA * normB);
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customPrompt = searchParams.get("customPrompt");
    const body = await request.json();
    const { screenData, startTime, endTime } = body;

    if (!customPrompt) {
      return NextResponse.json({ error: "customPrompt is required" }, { status: 400 });
    }

    if (!screenData) {
      return NextResponse.json({ error: "screenData is required" }, { status: 400 });
    }

    const settings = await pipe.settings.getAll();
    const deduplicationEnabled = settings.customSettings?.deduplicationEnabled ?? true;
    const model = settings.customSettings?.model ?? "llama3.2:3b-instruct-q4_K_M";

    let processedScreenData = screenData;
    
    if (deduplicationEnabled) {
      try {
        processedScreenData = await deduplicateScreenData(screenData);
      } catch (error) {
        console.warn("deduplication failed, continuing with original data:", error);
      }
    }
    const cleanedScreenData = await cleanOCRText(extractOCRText(processedScreenData));
    const chunks = await chunkOCRText(cleanedScreenData);

    const notes = [];
    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    for (const chunk of chunks) {
      const note = await generateNote(
        chunk,
        model,
        startTimeDate,
        endTimeDate,
        customPrompt,
      );
      notes.push(note);
    }

    if (notes.length === 0) {
      return NextResponse.json({ error: "Failed to generate any notes" }, { status: 400 });
    }

    const mergedNote = notes.length === 1 ? notes[0] : await mergeNotes(notes, customPrompt);

    // No need to convert timestamps again since they're already in ISO format
    return NextResponse.json({ note: mergedNote });
  } catch (error) {
    console.error("error generating work log:", error);
    return NextResponse.json({ error: "error generating work log" }, { status: 500 });
  }
}
