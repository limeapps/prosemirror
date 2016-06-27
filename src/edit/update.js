// ;; Helper for scheduling updates whenever any of a series of events
// happen. Created with the
// [`updateScheduler`](#ProseMirror.updateScheduler) method.
class UpdateScheduler {
  constructor(pm, subscriptions, start) {
    this.pm = pm
    this.scheduled = false

    this.run = () => {
      this.scheduled = false
      start()
    }
    this.onEvent = () => {
      if (!this.scheduled) {
        this.scheduled = true
        this.pm.scheduleViewUpdate()
      }
    }

    this.subscriptions = subscriptions
    this.subscriptions.forEach(sub => sub.add(this.onEvent))
    this.pm.on.updatedView.add(this.run)
  }

  // :: ()
  // Detach the event handlers registered by this scheduler.
  detach() {
    this.pm.on.updatedView.remove(this.run)
    this.subscriptions.forEach(sub => sub.remove(this.onEvent))
  }
}
exports.UpdateScheduler = UpdateScheduler
