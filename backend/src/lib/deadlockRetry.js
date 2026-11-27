// MariaDB (InnoDB) rolls back one of two transactions that wait for each other's locks and reports
// ER_LOCK_DEADLOCK (1213). That can happen between saves of two different courses: deleting a step
// checks the foreign key CourseStep.nextCourseStepId and locks the end of that index, and linking a
// new step needs to insert into that same range. MariaDB's advice is to run the transaction again;
// it was rolled back completely, so a retry is safe. With snapshot isolation (the default since
// MariaDB 11.6) a transaction that changes a row another transaction changed after its snapshot gets
// ER_CHECKREAD (1020, 'Record has changed since last read'), with the same advice: restart the
// transaction. That happens when 'Nieuwe versie gebruiken' and 'Aanpassen' (specs/011) hit the same
// reference at once. Only these two are retried, nothing else.

const RETRY = new Set(['ER_LOCK_DEADLOCK', 'ER_CHECKREAD'])

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs `transaction` (a function that starts and finishes one database transaction) and runs it
 * again when MariaDB reports a deadlock or a changed snapshot, at most `attempts` times in total. Between attempts a short,
 * slightly random pause, so two transactions that collided do not collide again straight away.
 */
export async function withDeadlockRetry(transaction, { attempts = 5, delayMs = 15 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await transaction()
    } catch (error) {
      if (!RETRY.has(error?.code) || attempt >= attempts) throw error
      await pause(delayMs * attempt + Math.random() * delayMs)
    }
  }
}
