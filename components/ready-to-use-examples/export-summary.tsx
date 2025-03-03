"use client"

import { db } from "@/lib/db";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button";
import { 
  Check,
  ChevronsUpDown,
  Trash2,
  Loader2,
  FileUp
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Note } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import Exports from "@/components/ready-to-use-examples/exports";

export default function SearchNote() {
    const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
    const [filteredNotes, setFilteredNotes] = useState<(Note & { id: number })[]>([]);
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [added, setAdded] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [newNote, setNewNote] = useState<Note & { id: number } | null>(null);
    const { toast } = useToast();

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

    useEffect(() => {
        if (value) {
            const filtered = notes.filter(note => note.tags.includes(value));
            setFilteredNotes(filtered);
        } else {
            setFilteredNotes([]);
        }
    }, [value, notes]);

    const deleteNote = async (id: number) => {
        try {
            await db.notes.delete(id);
            const noteExists = await db.notes.get(id);
            console.log(noteExists ? "Note was not deleted" : "Note deleted successfully");
            setNewNote(null)
            setNotes(notes.filter(note => note.id !== id));
            setFilteredNotes(filteredNotes.filter(note => note.id !== id));
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    }

    const getSummary = async () => {
        try {
            setIsLoading(true);
            const endTime = new Date();
            const startTime = new Date();
            const taggedNotes = notes.filter(note => note.tags.includes(value)).map(note => note.content).join("\n\n")
      
            const response = await fetch(`/api/summarize`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                tag: value,
                taggedNotes: taggedNotes
              }),
            });
      
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create note from recording');
            }
      
            const { note } = await response.json();
            
            // Add the note to IndexedDB
            await db.notes.add(note);
            setNewNote(note);
            setAdded(true);
      
            toast({
              title: "Recording Processed",
              description: `Created note: ${note.title}`,
            });
      
          } catch (error) {
            console.error('Error processing recording:', error);
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "Failed to process recording",
              variant: "destructive",
            });
          } finally {
            setIsLoading(false);
          }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Summarize Notes by Tags</CardTitle>
                <CardDescription>
                You can summarize and export your save notes using your tags
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[200px] justify-between"
                        >
                        {value
                            ? tags.find((tag) => tag === value)
                            : "Select tag..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                        <Command>
                        <CommandInput placeholder="Search tag..." />
                        <CommandList>
                            <CommandEmpty>No tag found.</CommandEmpty>
                            <CommandGroup>
                            {tags.map((tag) => (
                                <CommandItem
                                key={tag}
                                value={tag}
                                onSelect={(currentValue) => {
                                    setValue(currentValue === value ? "" : currentValue);
                                    setOpen(false);
                                }}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    value === tag ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {tag}
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Button onClick={() => getSummary()}>
                    Create
                </Button>
            </CardContent>
            <CardContent>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        {newNote && (
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold">Recent Document/Note</h3>
                                <div className="space-y-2">
                                    <div key={newNote.id} className="border p-2 rounded">
                                        <div className="font-medium">{newNote.title}</div>
                                        <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: newNote.content }} />
                                        <div className="text-xs text-gray-500">
                                            {new Date(newNote.startTime).toLocaleString()} - {new Date(newNote.endTime).toLocaleString()}
                                        </div>
                                        <div className="flex gap-2 mt-1 flex-wrap">
                                            {newNote.tags.map((tag) => (
                                                <div key={tag} className="flex items-center gap-1">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                                                        {tag}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 mt-2 justify-end">
                                            <Button onClick={() => deleteNote(newNote.id)} className="p-1 hover:bg-red-600 bg-red-500 text-white rounded-full">
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                            <Popover>
                                            <PopoverTrigger className="bg-black text-white rounded-3xl">
                                                <FileUp />
                                            </PopoverTrigger>
                                            <Exports note={newNote} />
                                        </Popover>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

