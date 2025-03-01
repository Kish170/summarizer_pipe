import Dexie from 'dexie';
import { useEffect, useState, useRef } from "react";
import { pipe } from "@screenpipe/browser";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  FileText,
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


// Define the database
class NotesDB extends Dexie {
  notes!: Dexie.Table<Note & { id: number }, number>;

  constructor() {
    super('NotesDB');
    this.version(1).stores({
      notes: '++id, title, content, startTime, endTime, *tags'
    });
  }
}

const db = new NotesDB();

export default function NoteSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
  const { toast } = useToast();
  const { settings, updateSettings, loading } = useSettings();
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setCustomPrompt(settings.prompt || "");
    }
  }, [settings]);

  const handleCreateNote = async () => {
    try {
      setIsLoading(true);
      
      const customPrompt = settings?.prompt || 
        "Generate a note document based on my recent screen activity";

      const interval = settings?.logTimeWindow ?? 60000;
      const pageSize = settings?.logPageSize ?? 100;
      
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - interval);

      const screenData = await pipe.queryScreenpipe({
        startTime: oneMinuteAgo.toISOString(),
        endTime: now.toISOString(),
        limit: pageSize,
        contentType: "all",
      });

      if (!screenData || !screenData.data || screenData.data.length === 0) {
        throw new Error("No activity detected");
      }

      const response = await fetch(`/api/notes?customPrompt=${encodeURIComponent(customPrompt)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          screenData: screenData.data,
          startTime: oneMinuteAgo.toISOString(),
          endTime: now.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.message || 'Failed to create work log');
        } catch (e) {
          throw new Error(`API Error: ${errorText || response.statusText}`);
        }
      }

      const responseText = await response.text();
      console.log('API Response:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON Parse Error:', e);
        throw new Error('Invalid response format from API');
      }

      const {note } = data;
      
      if (!note) {
        throw new Error('No work log data in response');
      }

      // Store in Dexie
      const savedLog = await db.notes.add(note);
      
      // Refresh logs list
      const updatedLogs = await db.notes.toArray();
      setNotes(updatedLogs);
      
      toast({
        title: "Work Log Created",
        description: `Successfully created work log: ${note.title}`,
      });
    } catch (error) {
      console.error('Error creating work log:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create work log",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  // const handleCreateWorkLog = async () => {
  //   try {
  //     setIsLoading(true);
      
  //     const customPrompt = settings?.prompt || 
  //       "Generate a work log entry based on my recent screen activity";

  //     const interval = settings?.logTimeWindow ?? 60000;
  //     const pageSize = settings?.logPageSize ?? 100;
      
  //     const now = new Date();
  //     const oneMinuteAgo = new Date(now.getTime() - interval);

  //     const screenData = await pipe.queryScreenpipe({
  //       startTime: oneMinuteAgo.toISOString(),
  //       endTime: now.toISOString(),
  //       limit: pageSize,
  //       contentType: "all",
  //     });

  //     if (!screenData || !screenData.data || screenData.data.length === 0) {
  //       throw new Error("No activity detected");
  //     }

  //     const response = await fetch(`/api/notes?customPrompt=${encodeURIComponent(customPrompt)}`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         screenData: screenData.data,
  //         startTime: oneMinuteAgo.toISOString(),
  //         endTime: now.toISOString(),
  //       }),
  //     });

  //     if (!response.ok) {
  //       const errorText = await response.text();
  //       console.error('API Error Response:', errorText);
  //       try {
  //         const error = JSON.parse(errorText);
  //         throw new Error(error.message || 'Failed to create work log');
  //       } catch (e) {
  //         throw new Error(`API Error: ${errorText || response.statusText}`);
  //       }
  //     }

  //     const responseText = await response.text();
  //     console.log('API Response:', responseText);
      
  //     let data;
  //     try {
  //       data = JSON.parse(responseText);
  //     } catch (e) {
  //       console.error('JSON Parse Error:', e);
  //       throw new Error('Invalid response format from API');
  //     }

  //     const { workLog } = data;
      
  //     if (!workLog) {
  //       throw new Error('No work log data in response');
  //     }

  //     // Store in Dexie
  //     const savedLog = await db.worklogs.add(workLog);
      
  //     // Refresh logs list
  //     const updatedLogs = await db.worklogs.toArray();
  //     setLogs(updatedLogs);
      
  //     toast({
  //       title: "Work Log Created",
  //       description: `Successfully created work log: ${workLog.title}`,
  //     });
  //   } catch (error) {
  //     console.error('Error creating work log:', error);
  //     toast({
  //       title: "Error",
  //       description: error instanceof Error ? error.message : "Failed to create work log",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Log Creation</CardTitle>
        <CardDescription>
          Generate work logs based on your screen activity from the last minute
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
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <Button 
            onClick={handleCreateNote}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Log...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Create Work Log
              </>
            )}
          </Button>
        </div>
        
        {/* Display existing logs */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Stored Logs ({notes.length})</h3>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="border p-2 rounded">
                <div className="font-medium">{note.title}</div>
                <div className="text-sm text-gray-600">{note.content}</div>
                <div className="text-xs text-gray-500">
                  {new Date(note.startTime).toLocaleString()} - {new Date(note.endTime).toLocaleString()}
                </div>
                <div className="flex gap-1 mt-1">
                  {note.tags.map((tag) => (
                    <span key={tag} className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
