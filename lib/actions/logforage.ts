// import Dexie, { Table } from 'dexie'
// import { WorkLog } from "@/lib/types";

// class WorkLogDatabase extends Dexie {
//   worklogs!: Table<WorkLog>;

//   constructor() {
//     super('WorkLogApp');
//     this.version(1).stores({
//       worklogs: '++id, title, startTime, endTime'
//     });
//   }
// }

// const db = new WorkLogDatabase();

// export class WorkLogService {
//   // Create a new work log
//   static async create(logData: WorkLog): Promise<WorkLog> {
//     const id = await db.worklogs.add(logData);
//     return { ...logData, id };
//   }

//   // Get a work log by ID
//   static async get(id: string): Promise<WorkLog | null> {
//     return await db.worklogs.get(id);
//   }

//   // Update a work log
//   static async update(id: string, logData: Partial<WorkLog>): Promise<WorkLog | null> {
//     await db.worklogs.update(id, logData);
//     return await this.get(id);
//   }

//   // Delete a work log
//   static async delete(id: string): Promise<void> {
//     await db.worklogs.delete(id);
//   }
// }