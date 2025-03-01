"use client";

import { useEffect, useState, useRef } from "react";
import { pipe, VisionEvent, type TranscriptionChunk } from "@screenpipe/browser";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Save, 
  Trash, 
  FileDown, 
  Mic, 
  Monitor,
  FileText,
  RefreshCw
} from "lucide-react";
import { useSettings } from "@/lib/settings-provider";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Note {
  id: string;
  content: string;
  timestamp: string;
  title?: string;
  source: 'screen' | 'audio' | 'combined';
  rawData?: {
    screenText?: string;
    audioTranscription?: string;
  };
}

export function AIEducationalNotes() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentScreenData, setCurrentScreenData] = useState<string>("");
  const [currentAudioData, setCurrentAudioData] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioStreamRef = useRef<any>(null);
  const screenStreamRef = useRef<any>(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('educational_notes');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (err) {
        console.error('Error loading notes:', err);
        setError('Failed to load saved notes');
      }
    }
  }, []);

  // Save notes to localStorage when they change
  useEffect(() => {
    localStorage.setItem('educational_notes', JSON.stringify(notes));
  }, [notes]);

  const startRecording = async () => {
    try {
      setError(null);
      setIsRecording(true);
      setCurrentScreenData("");
      setCurrentAudioData("");

      // Start screen capture
      const screenStream = pipe.streamVision(true);
      screenStreamRef.current = screenStream;
      
      // Start audio capture if enabled
      if (settings?.screenpipeAppSettings?.enableRealtimeAudioTranscription) {
        const audioStream = pipe.streamTranscriptions();
        audioStreamRef.current = audioStream;

        // Process audio stream
        (async () => {
          try {
            for await (const event of audioStream) {
              if (event.choices?.[0]?.text) {
                setCurrentAudioData(prev => prev + " " + event.choices[0].text);
              }
            }
          } catch (error) {
            console.error("Audio stream error:", error);
          }
        })();
      }

      // Process screen stream
      for await (const event of screenStream) {
        if (event.data?.text) {
          setCurrentScreenData(prev => prev + " " + event.data.text);
        }
      }
    } catch (error) {
      console.error("Recording error:", error);
      setError("Failed to start recording");
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (screenStreamRef.current) {
      screenStreamRef.current.return?.();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.return?.();
    }

    // Process the collected data
    if (currentScreenData || currentAudioData) {
      await processAndSaveNote();
    }
  };

  const processAndSaveNote = async () => {
    setIsProcessing(true);
    try {
      // Combine screen and audio data
      const combinedInput = `
Screen Content:
${currentScreenData}

Audio Transcription:
${currentAudioData}

Please create educational notes from this content. Format them in a clear, structured way with:
- Main topics/concepts
- Key points
- Important definitions
- Any formulas or equations
- Examples mentioned
Use markdown formatting.
`;

      // Call Ollama API
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama2:3b-instruct',
          prompt: combinedInput,
          stream: false,
        }),
      });

      const result = await response.json();
      
      // Create new note
      const newNote: Note = {
        id: Date.now().toString(),
        content: result.response,
        timestamp: new Date().toISOString(),
        source: currentScreenData && currentAudioData ? 'combined' : currentScreenData ? 'screen' : 'audio',
        rawData: {
          screenText: currentScreenData || undefined,
          audioTranscription: currentAudioData || undefined,
        }
      };

      setNotes(prev => [newNote, ...prev]);
      toast({
        title: "Success",
        description: "Notes generated and saved successfully",
      });
    } catch (error) {
      console.error("Processing error:", error);
      setError("Failed to process and generate notes");
      toast({
        title: "Error",
        description: "Failed to generate notes",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setCurrentScreenData("");
      setCurrentAudioData("");
    }
  };

  const exportAsMarkdown = (note: Note) => {
    const blob = new Blob([note.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `note-${new Date(note.timestamp).toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Educational Notes</CardTitle>
        <CardDescription>
          Automatically generate educational notes from your screen content and audio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 justify-between items-center">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant={isRecording ? "destructive" : "default"}
            disabled={isProcessing}
          >
            {isRecording ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Stop Recording
              </>
            ) : (
              <>
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <>
                    <Monitor className="w-4 h-4 mr-2" />
                    <Mic className="w-4 h-4 mr-2" />
                  </>
                )}
                Start Recording
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <div className="space-y-4">
          <h3 className="font-semibold">Generated Notes</h3>
          {notes.length === 0 ? (
            <p className="text-sm text-gray-500">No notes generated yet. Start recording to create notes!</p>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <Card key={note.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm text-gray-500">
                          {new Date(note.timestamp).toLocaleString()}
                        </span>
                        <span className="ml-2 text-xs px-2 py-1 bg-gray-100 rounded-full">
                          {note.source}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportAsMarkdown(note)}
                        >
                          <FileDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNotes(prev => prev.filter(n => n.id !== note.id));
                            toast({
                              title: "Success",
                              description: "Note deleted successfully",
                            });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap">{note.content}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 