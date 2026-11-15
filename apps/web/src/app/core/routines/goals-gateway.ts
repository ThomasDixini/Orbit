import { Observable } from 'rxjs';
import { Goal, GoalChanges } from './goal';

/**
 * Port to wherever goals and their progress are stored. The store depends on this class only;
 * `app.config.ts` binds it to the HTTP adapter and tests to a fake. Progress is always the one of
 * the period around the given day, so a new week starts at zero and past weeks keep theirs.
 */
export abstract class GoalsGateway {
  /** Every goal not deleted, with its progress in the period around `isoDay`, in creation order. */
  abstract list(isoDay: string): Observable<readonly Goal[]>;

  /**
   * The goals as they stood on a past `isoDay`: like `list`, plus the goals deleted after that day, so
   * the history keeps them.
   */
  abstract listIncludingDeleted(isoDay: string): Observable<readonly Goal[]>;

  /** Saves a goal built on the client; answers with the stored (normalized) version. */
  abstract create(goal: Goal, isoDay: string): Observable<Goal>;

  /** Edits a goal (not its type or category); answers with the stored version. */
  abstract update(goalId: string, changes: GoalChanges, isoDay: string): Observable<Goal>;

  /**
   * Deletes a goal from `isoDay` on; the history of earlier days keeps it and its progress.
   * Deleting one already gone succeeds.
   */
  abstract delete(goalId: string, isoDay: string): Observable<void>;

  /** Marks an objective achieved on `isoDay`, or takes the mark back; answers with the objective. */
  abstract setAchievement(goalId: string, isoDay: string, isAchieved: boolean): Observable<Goal>;
}
