import Dexie from 'dexie';
import { WorkLog, Note } from "@/lib/types";


class NotesDB extends Dexie {
    notes!: Dexie.Table<Note & { id: number }, number>;
  
    constructor() {
      super('NotesDB');
      this.version(1).stores({
        notes: '++id, title, content, startTime, endTime, *tags'
      });
    }
  }
  
export const db = new NotesDB();