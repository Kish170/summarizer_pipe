import Dexie from 'dexie';
import { useEffect, useState, useRef } from "react";
import { pipe } from "@screenpipe/browser";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  FileText,
  Play,
  Square,
  Trash,
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
import { WorkLog, Note } from "@/lib/types";
import { FileSuggestTextarea } from "@/components/file-suggest-textarea";
import { Label } from "@/components/ui/label";
import { FileCheck } from "lucide-react";
import { db } from "@/lib/db";

export default function GenerateNote() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
  const recordingStartTime = useRef<Date | null>(null);
  const { toast } = useToast();
  const { settings, updateSettings, loading } = useSettings();
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setCustomPrompt(settings.prompt || "");
    }
  }, [settings]);

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create note from recording');
      }

      const { note } = await response.json();
      
      // Add the note to IndexedDB
      const id = await db.notes.add(note);
      
      // Refresh notes list
      const updatedNotes = await db.notes.toArray();
      setNotes(updatedNotes);

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

          {/* Display existing notes */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Stored Notes ({notes.length})</h3>
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="border p-2 rounded">
                  <div className="font-medium">{note.title}</div>
                  <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: note.content }} />
                  <div className="text-xs text-gray-500">
                    {new Date(note.startTime).toLocaleString()} - {new Date(note.endTime).toLocaleString()}
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {note.tags.map((tag) => (
                      <div key={tag} className="flex items-center gap-1">
                        <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                          {tag}
                        </span>
                        <button 
                          className="p-1 hover:bg-red-600 bg-red-500 text-white rounded-full"
                          onClick={async () => {
                            const updatedTags = note.tags.filter(t => t !== tag);
                            await db.notes.update(note.id, { tags: updatedTags });
                            const updatedNotes = await db.notes.toArray();
                            setNotes(updatedNotes);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
