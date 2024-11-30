export interface Set {
    exercise: string;
    weight: string;
    reps: string;
    setNumber: string;
    timestamp?: string;
}

export class SetUtils {
    // Once the "sets" column is renamed, this can be removed.
    static fromBackend(item: any): Set {
      return {
        exercise: item.exercise,
        weight: item.weight,
        reps: item.reps,
        setNumber: item.sets, 
        timestamp: item.timestamp, 
      };
    }
  }