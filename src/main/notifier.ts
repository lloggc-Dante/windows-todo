import { Notification } from 'electron'

export interface NotificationWindow {
  showMainWindow(): void
  showTask(taskId: string): void
}

export interface Notifier {
  showTaskReminder(task: { id: string; title: string }, onClick: () => void): void
  showSummary(count: number, onClick: () => void): void
}

export class WindowsNotifier implements Notifier {
  showTaskReminder(task: { id: string; title: string }, onClick: () => void): void {
    const notification = new Notification({ title: '任务提醒', body: task.title })
    notification.on('click', onClick)
    notification.show()
  }

  showSummary(count: number, onClick: () => void): void {
    const notification = new Notification({
      title: '错过的提醒',
      body: `${count} 个任务需要关注`,
    })
    notification.on('click', onClick)
    notification.show()
  }
}
