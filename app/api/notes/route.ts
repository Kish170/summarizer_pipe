import { NextResponse } from "next/server";
import { ContentItem } from "@screenpipe/js";
import { embed, generateObject } from "ai";
import { ollama } from "ollama-ai-provider";
import { z } from "zod";
import { WorkLog } from "@/lib/types";
import { Note } from "@/lib/types";
import { pipe } from "@screenpipe/js";

const workLog = z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string())
});

const note = z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string())
});

// might add audio data although it doesn't seem to be available with my system
async function generateNote(
    screenData: ContentItem[],
    model: string,
    startTime: Date,
    endTime: Date,
    customPrompt: string,
  ): Promise<Note> {
  
    const defaultPrompt = `You are analyzing screen recording data from Screenpipe to create educational notes. The data includes OCR text, audio transcriptions, and media files from learning activities.
  
      Based on the following screen data, generate a structured educational note with proper HTML formatting.
  
      Here are some user instructions:
      ${customPrompt}
  
      Screen data: ${JSON.stringify(screenData)}
      
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
      - Link to concepts using [[concept-name]]
      - Add relevant educational tags
      - Include key learning points and takeaways
      - Structure content for easy review and reference
      
      Example outputs:
      {
          "title": "Introduction to Neural Networks",
          "content": "<h1>Introduction to Neural Networks</h1>
          <h2>Key Concepts</h2>
          <p>Explored the fundamentals of [[neural-networks]] and their applications in [[machine-learning]].</p>
          <h3>Basic Components</h3>
          <ul>
            <li><strong>Neurons</strong>: Basic processing units</li>
            <li><strong>Weights</strong>: Connection strengths</li>
            <li><strong>Activation Functions</strong>: Decision mechanisms</li>
          </ul>
          <h2>Implementation Example</h2>
          <code>
          def simple_neuron(inputs, weights):
              return activation(sum(i * w for i, w in zip(inputs, weights)))
          </code>",
          "tags": ["#deep-learning", "#neural-networks", "#machine-learning"]
      }

      {
          "title": "Data Structures: Binary Trees",
          "content": "<h1>Data Structures: Binary Trees</h1>
          <h2>Understanding Tree Traversal</h2>
          <p>Deep dive into [[binary-tree]] traversal methods and their applications in [[algorithms]].</p>
          <h3>Traversal Types</h3>
          <ol>
            <li><em>In-order</em>: Left, Root, Right</li>
            <li><em>Pre-order</em>: Root, Left, Right</li>
            <li><em>Post-order</em>: Left, Right, Root</li>
          </ol>
          <blockquote>Remember: The choice of traversal depends on the specific use case!</blockquote>",
          "tags": ["#data-structures", "#algorithms", "#binary-trees"]
      }

      Return a JSON object with:
      {
          "title": "Clear, topic-focused title",
          "content": "HTML-formatted educational content with proper structure",
          "tags": ["#relevant-topic", "#subject-area", "#learning-concept"]
      }`;
  
    const provider = ollama(model);
    const response = await generateObject({
      model: provider,
      messages: [{ role: "user", content: defaultPrompt }],
      schema: note,
    });
  
    const formatDate = (date: Date) => {
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };
  
    return {
      ...response.object,
      startTime: formatDate(startTime),
      endTime: formatDate(endTime),
    };
}

async function deduplicateScreenData(
    screenData: ContentItem[]
  ): Promise<ContentItem[]> {
    if (!screenData.length) return screenData;
  
    try {
      const provider = ollama.embedding("nomic-embed-text");
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
                model: provider,
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
    
    // Only deduplicate if enabled in settings
    if (deduplicationEnabled) {
      try {
        processedScreenData = await deduplicateScreenData(screenData);
      } catch (error) {
        console.warn("deduplication failed, continuing with original data:", error);
      }
    }

    const note = await generateNote(
      processedScreenData,
      model,
      new Date(startTime),
      new Date(endTime),
      customPrompt,
    );

    return NextResponse.json({ note });
  } catch (error) {
    console.error("error generating work log:", error);
    return NextResponse.json({ error: "error generating work log" }, { status: 500 });
  }
}
