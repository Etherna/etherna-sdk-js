export interface QueueOptions {
  /**
   * The maximum number of tasks that can be run concurrently.
   * Default: Infinity
   */
  maxConcurrentTasks?: number
  /**
   * The mode in which the queue should drain.
   * - `background` (default): The queue will drain in the background, allowing new tasks to be enqueued while draining.
   * - `manual`: The queue will not allow new tasks to be run until manually started.
   */
  drainMode?: "background" | "manual"
}

export class Queue {
  tasks: { key?: string; task: () => Promise<void> }[] = []
  activeTasks: number = 0
  maxConcurrentTasks: number
  drainMode: "background" | "manual"

  private drainPromiseResolver?: () => void

  constructor(options?: QueueOptions) {
    this.maxConcurrentTasks = options?.maxConcurrentTasks ?? Infinity
    this.drainMode = options?.drainMode ?? "background"
  }

  public enqueue(task: () => Promise<void>, key?: string) {
    this.tasks.push({ task, key })

    if (this.drainMode === "background") {
      this.runTasks()
    }
  }

  public dequeue(key: string) {
    this.tasks = this.tasks.filter((task) => task.key !== key)
  }

  public async drain(key?: string) {
    if (this.tasks.length === 0) {
      return
    }

    if (this.drainMode === "manual") {
      this.runTasks(key)
    }

    return new Promise<void>((resolve) => {
      this.drainPromiseResolver = resolve
    })
  }

  private runTasks(key?: string) {
    const filteredTasks = key ? this.tasks.filter((task) => task.key === key) : this.tasks

    if (filteredTasks.length === 0) {
      this.drainPromiseResolver?.()
      this.drainPromiseResolver = undefined

      return
    }

    while (this.activeTasks < this.maxConcurrentTasks && filteredTasks.length > 0) {
      const { task } = filteredTasks.shift() ?? {}
      if (task) {
        this.activeTasks++
        task().finally(() => {
          this.activeTasks--
          this.runTasks(key)
        })
      }
    }
  }
}
