import { OpenAI } from "openai";
import { pipe } from "@screenpipe/js";
import { Note } from "@/lib/types";
import { NextResponse } from "next/server";

async function convertToMarkdown (note:Note & { id: number }):Promise<string> {
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
            content: `You are a helpful assistant that converts structured educational content from HTML into Markdown format.
            
            Given an object with title, content (HTML), and tags, return a Markdown-formatted string following this structure:

            # {title}
            **Tags:** {tags formatted as #tag1 #tag2 #tag3}

            {content converted from HTML to Markdown format}

            **Rules for Markdown conversion:**
            - Convert <h1> to # Header
            - Convert <h2> to ## Header
            - Convert <h3> to ### Header
            - Convert <p> to normal text with line breaks
            - Convert lists (<ul> or <ol>) to:
              - "- item" for unordered lists
              - "1. item" for ordered lists
            - Convert <strong> or <b> to **bold**
            - Convert <em> or <i> to *italic*
            - Preserve hyperlinks using [text](url)
            - Remove all other unnecessary HTML tags`
        },
        {
            role: "user", 
            content: `Here is a note that needs to be converted to Markdown:

            {
                "title": "${note.title}",
                "content": "${note.content}",
                "tags": ${JSON.stringify(note.tags)}
            }`
        }
      ]
    });

    let content = output.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to get content from the model response");
    }
    if (content.startsWith("```json")) {
        content = content.slice(7, -3).trim();
      } else if (content.startsWith("```")) {
        content = content.slice(3, -3).trim(); 
      }
    console.log("content:", content)
    return content
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { note } = body;

        const markDown = await convertToMarkdown(note);
        console.log("markdown", markDown)
        if(!markDown) {
            return NextResponse.json({ error: "Failed to generate markdown" }, { status: 400 });
        }
        return NextResponse.json({markDown:markDown})
    } catch(error) {
        console.error("error generating work log:", error);
            return NextResponse.json({ error: "error generating work log" }, { status: 500 });
    }
}