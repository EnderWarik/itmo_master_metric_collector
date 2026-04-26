import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type TaskStatus = 'pending' | 'running' | 'done' | 'error';

export interface Task<T = unknown> {
  id: string;
  status: TaskStatus;
  result?: T;
  error?: string;
  createdAt: number;
  finishedAt?: number;
}

@Injectable()
export class TaskRegistry {
  private readonly tasks = new Map<string, Task>();
  private readonly TTL_MS = 30 * 60 * 1000;

  create<T>(executor: () => Promise<T>): string {
    const id = randomUUID();
    const task: Task<T> = {
      id,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.tasks.set(id, task);

    queueMicrotask(async () => {
      task.status = 'running';
      try {
        task.result = await executor();
        task.status = 'done';
      } catch (e) {
        task.status = 'error';
        task.error = e instanceof Error ? e.message : String(e);
      } finally {
        task.finishedAt = Date.now();
      }
    });

    this.cleanup();
    return id;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, task] of this.tasks) {
      if (task.finishedAt && now - task.finishedAt > this.TTL_MS) {
        this.tasks.delete(id);
      }
    }
  }
}
