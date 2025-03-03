import React from 'react'
import { PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { useEffect, useState, useRef } from "react";
import { Note } from "@/lib/types";
import { pipe } from "@screenpipe/browser"

const exports = ({ note }: { note: Note & { id: number } }) => {
    const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
    const [tags, setTags] = useState<string[]>([]);

    useEffect(() => {
        const fetchNotes = async () => {
            const notes = await db.notes.toArray();
            const allTags = notes.flatMap(note => note.tags);
            const uniqueTags = Array.from(new Set(allTags));
            setTags(uniqueTags);
            setNotes(notes);
        };
        fetchNotes();
    }, []);

    const getMarkDown = async (id: number) => {
        const noteToMark = notes.find(note => note.id === id);
        if (!noteToMark) {
            console.error("Note not found");
            return null; 
        }

        try {
            const response = await fetch("api/export-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note: noteToMark }),
            });

            if (!response.ok) {
                throw new Error("Failed to create markdown of note");
            }

            const data = await response.json();
            console.log("API Response:", data); 
            return data.markDown || ""; 
        } catch (error) {
            console.error("Error processing note:", error);
            return null; 
        }
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const checker = async () => {
        window.open("https://docs.google.com/", "_blank");
        await pipe.sendDesktopNotification({
            title: "Exporting",
            body: "Click on the blank document button please!"
        })
        await sleep(10000)
        await pipe.input.type("what's good bbg")
    }

    const txtExport = async (id: number) => {
        const content = await getMarkDown(id);
        console.log(content); 

        const title = notes.find(note => note.id === id)?.title || "Untitled";
        
        if (content) {
            const blob = new Blob([content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${title}.txt`; // Ensure the file extension is .txt
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            console.error("Failed to get content for export");
        }
    };
    return (
        <PopoverContent className="flex flex-col [&>*]:m-2">
            <Button onClick={()=>txtExport(note.id)}>.txt file</Button>
            <Button disabled>Google Docs</Button>
            <Button disabled>Notion</Button>
        </PopoverContent>
    )
}

export default exports