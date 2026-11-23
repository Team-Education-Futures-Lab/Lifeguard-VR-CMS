// MariaDB (InnoDB) rolls back one of two transactions that wait for each other's locks and reports
// ER_LOCK_DEADLOCK (1213). That can happen between saves of two different courses: deleting a step
// checks the foreign key CourseStep.nextCourseStepId and locks the end of that index, and linking a
// new step needs to insert into that same range. MariaDB's advice is to run the transaction again;
// it was rolled back completely, so a retry is safe. Only deadlocks are retried, nothing else.

const DEADLOCK = 'ER_LOCK_DEADLOCK'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs `transaction` (a function that starts and finishes one database transaction) and runs it
 * again when MariaDB reports a deadlock, at most `attempts` times in total. Between attempts a short,
 * slightly random pause, so two transactions that collided do not collide again straight away.
 */
export async function withDeadlockRetry(transaction, { attempts = 5, delayMs = 15 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await transaction()
    } catch (error) {
      if (error?.code !== DEADLOCK || attempt >= attempts) throw error
      await pause(delayMs * attempt + Math.random() * delayMs)
    }
  }
}
