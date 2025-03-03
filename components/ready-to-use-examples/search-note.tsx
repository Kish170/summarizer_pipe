"use client"

import { db } from "@/lib/db";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button";
import { 
  Check,
  ChevronsUpDown,
  Trash2,
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
import Exports from "@/components/ready-to-use-examples/exports"


export default function SearchNote() {
    const [tags, setTags] = useState<string[]>([]);
    const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
    const [filteredNotes, setFilteredNotes] = useState<(Note & { id: number })[]>([]);
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");

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
            setNotes(notes.filter(note => note.id !== id));
            setFilteredNotes(filteredNotes.filter(note => note.id !== id));
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Search Notes by Tags</CardTitle>
                <CardDescription>
                You can search notes by tags.
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

                {/* Render filtered notes */}
                {filteredNotes.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-lg font-semibold">Filtered Notes</h3>
                        <div className="space-y-2">
                            {filteredNotes.map(note => (
                                <div key={note.id} className="border p-2 rounded w-full">
                                    <div className="font-medium">{note.title}</div>
                                    <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: note.content }} />
                                    <div className="text-xs text-gray-500">
                                        {new Date(note.startTime).toLocaleString()} - {new Date(note.endTime).toLocaleString()}
                                    </div>
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                        {note.tags.map(tag => (
                                            <div key={tag} className="flex items-center gap-1">
                                                <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                                                    {tag}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="[&>*]:p-2 [&>*]:m-2 flex">
                                        <Button onClick={() => deleteNote(note.id)} className=" hover:bg-red-600 bg-red-500 text-white rounded-full" >
                                            <Trash2 className="m-0 w-3 h-3" />
                                        </Button>
                                        <Popover>
                                            <PopoverTrigger className="bg-black text-white rounded-3xl">
                                                <FileUp />
                                            </PopoverTrigger>
                                            <Exports note={note} />
                                        </Popover>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

