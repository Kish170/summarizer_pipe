"use client"

import { db } from "@/lib/db";
import { useEffect, useState, useRef } from "react";
import { pipe } from "@screenpipe/browser";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  FileText,
  Play,
  Square,
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


export default function SearchNote() {
    useEffect(() => {
        const fetchNotes = async () => {
            const notes = await db.notes.filter((note) => note.content.toLowerCase().includes("mach")).toArray();
            console.log(notes);
        }
        fetchNotes();
    }, []);
    return (
        <Card>
        <CardHeader>
            <CardTitle>Search Notes by Tags</CardTitle>
            <CardDescription>
            You can search notes by tags.
            </CardDescription>
        </CardHeader>
        <CardContent>
            
        </CardContent>
        </Card>
    )
}

