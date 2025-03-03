"use client";

import { useEffect, useState, useRef } from "react";
import { pipe, type TranscriptionChunk } from "@screenpipe/browser";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  FileUp,
  Trash2
} from "lucide-react";
import { useSettings } from "@/lib/settings-provider";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/db";
import { Note } from "@/lib/types";
import {
  Popover,
  PopoverTrigger,
} from "@/components/ui/popover"
import Exports from "@/components/ready-to-use-examples/exports";


export function RealtimeAudio() {
  const { settings } = useSettings();
  const [transcription, setTranscription] = useState<TranscriptionChunk | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string | null>("Generate notes based on OCR data");
  const [history, setHistory] = useState('');
  const [newNote, setNewNote] = useState<Note & { id: number } | null>(null);
  const historyRef = useRef(history);
  const streamRef = useRef<any>(null);
  const recordingStartTime = useRef<Date | null>(null);
  const [notes, setNotes] = useState<(Note & { id: number })[]>([]);  const [filteredNotes, setFilteredNotes] = useState<(Note & { id: number })[]>([]);
  const [value, setValue] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchNotes = async () => {
        const notes = await db.notes.toArray();
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

  // Update ref when history changes
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const startStreaming = async () => {
    try {
      // Check if realtime transcription is enabled
      if (!settings?.screenpipeAppSettings?.enableRealtimeAudioTranscription) {
        const errorMessage = "Realtime audio transcription is not enabled in settings. Go to Account > Settings > Recording > Enable realtime audio transcription > Models to use: screenpipe cloud. Then refresh the page.";
        setError(errorMessage);
      }
      
      recordingStartTime.current = new Date();
      setError(null);
      setIsStreaming(true);
      
      const stream = pipe.streamTranscriptions();
      streamRef.current = stream;

      toast({
        title: "Recording Started",
        description: "Capturing audio content...",
      });

      for await (const event of stream) {
        if (event.choices?.[0]?.text) {
          const chunk: TranscriptionChunk = {
            transcription: event.choices[0].text,
            timestamp: event.metadata?.timestamp || new Date().toISOString(),
            device: event.metadata?.device || 'unknown',
            is_input: event.metadata?.isInput || false,
            is_final: event.choices[0].finish_reason !== null
          };
          
          setTranscription(chunk);
          const newHistory = historyRef.current + ' ' + chunk.transcription;
          setHistory(newHistory);
        }
      }
    } catch (error) {
      console.error("Audio stream failed:", error);
      const errorMessage = error instanceof Error 
        ? `Failed to stream audio: ${error.message}`
        : "Failed to stream audio";
      setError(errorMessage);
      setIsStreaming(false);
    }
  };

  const stopStreaming = async () => {
    if (streamRef.current) {
      streamRef.current.return?.();
    }
    setIsStreaming(false);
    try {
      if (!recordingStartTime.current) {
        throw new Error("No recording start time found");
      }
      const endTime = new Date();

      const response = await fetch(`/api/audio-note?customPrompt=${encodeURIComponent(customPrompt || "")}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: history,
          startTime: recordingStartTime.current.toISOString(),
          endTime: endTime.toISOString()
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

      toast({
        title: "Recording Processed",
        description: `Created note: ${note.title}`,
      });
      setHistory("");

    } catch (error) {
      console.error('Error processing recording:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process recording",
        variant: "destructive",
      });
    } finally {
      recordingStartTime.current = null;
    }
  };

  const renderTranscriptionContent = (transcription: TranscriptionChunk) => {
    return (
      <div className="space-y-2">
        <div className="bg-slate-100 rounded p-2 overflow-auto max-h-[100px] whitespace-pre-wrap font-mono text-xs">
          {transcription.transcription}
        </div>
        
        {history && (
          <div className="mt-2">
            <div className="text-slate-600 font-semibold mb-1">History:</div>
            <div className="bg-slate-100 rounded p-2 overflow-auto h-[130px] whitespace-pre-wrap font-mono text-xs">
              {history}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button 
          onClick={isStreaming ? stopStreaming : startStreaming} 
          size="sm"
        >
          {isStreaming ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Stop Streaming
            </>
          ) : (
            'Start Audio Transcription'
          )}
        </Button>
        
        {history && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(history);
              setHistory('');
            }}
          >
            Clear History
          </Button>
        )}
      </div>
      
      {error && <p className="text-xs text-red-500">{error}</p>}
      {transcription && renderTranscriptionContent(transcription)}
      
      <div className="flex items-center gap-1.5 text-right justify-end">
        <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-green-500' : 'bg-gray-400'}`} />
        <span className="text-xs text-gray-500 font-mono">
          {isStreaming ? 'streaming' : 'stopped'}
        </span>
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
                  <Popover>
                      <PopoverTrigger className="bg-black text-white rounded-3xl">
                          <FileUp />
                      </PopoverTrigger>
                      <Exports note={newNote} />
                  </Popover>
              </div>
          </div>
        </div>}
    </div>
  );
}