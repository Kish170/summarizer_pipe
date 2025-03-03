import { useEffect, useState, useRef } from "react";
import { pipe } from "@screenpipe/browser";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Play,
  Square,
  Trash2
} from "lucide-react";
import { useSettings } from "@/lib/settings-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Note } from "@/lib/types";
import { FileSuggestTextarea } from "@/components/file-suggest-textarea";
import { Label } from "@/components/ui/label";
import { FileCheck } from "lucide-react";
import { db } from "@/lib/db";

export default function GenerateNote() {
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartTime = useRef<Date | null>(null);
  const { toast } = useToast();
  const [customPrompt, setCustomPrompt] = useState<string | null>("Generate notes based on OCR data");
  const [newNote, setNewNote] = useState<Note & { id: number } | null>(null);
  const [added, setAdded] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<(Note & { id: number })[]>([]);
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
            setNewNote(null)
            setNotes(notes.filter(note => note.id !== id));
            setFilteredNotes(filteredNotes.filter(note => note.id !== id));
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    }

  const startRecording = async () => {
    try {
      recordingStartTime.current = new Date();
      setIsRecording(true);
      
      toast({
        title: "Recording Started",
        description: "Capturing screen content...",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Error",
        description: "Failed to start recording",
        variant: "destructive",
      });
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingStartTime.current) {
        throw new Error("No recording start time found");
      }

      setIsLoading(true);
      const endTime = new Date();
      
      const screenData = await pipe.queryScreenpipe({
        startTime: recordingStartTime.current.toISOString(),
        endTime: endTime.toISOString(),
        limit: 1000,
        contentType: "all",
      });

      if (!screenData || !screenData.data || screenData.data.length === 0) {
        throw new Error("No screen data captured");
      }

      const response = await fetch(`/api/notes?customPrompt=${encodeURIComponent(customPrompt || "")}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          screenData: screenData.data,
          startTime: recordingStartTime.current.toISOString(),
          endTime: endTime.toISOString(),
          settings: settings
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
      setIsRecording(false);
      setIsLoading(false);
      recordingStartTime.current = null;
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Notes</CardTitle>
        <CardDescription>
          Record screen activity and generate educational notes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="prompt" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            custom prompt
          </Label>
          <FileSuggestTextarea
            value={customPrompt || ""}
            setValue={setCustomPrompt}
          />
          <p className="text-xs text-muted-foreground">
            customize how activity logs and insights are generated
          </p>
        </div>
      </CardContent>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            {!isRecording ? (
              <Button 
                onClick={startRecording}
                disabled={isLoading}
                variant="outline"
              >
                <Play className="mr-2 h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <Button 
                onClick={stopRecording}
                disabled={isLoading}
                variant="outline"
                className="bg-red-100 hover:bg-red-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Square className="mr-2 h-4 w-4" />
                    Stop Recording
                  </>
                )}
              </Button>
            )}
          </div>

          {newNote &&
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
                </div>
                <div className="[&>*]:p-2 [&>*]:m-2">
                    <Button onClick={() => deleteNote(newNote.id)} className="p-1 hover:bg-red-600 bg-red-500 text-white rounded-full" >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost">
                        Export
                    </Button>
                </div>
            </div>
          </div>}
        </div>
      </CardContent>
    </Card>
  );
}
