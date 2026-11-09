// Runs `tasks` (functions returning promises) with at most `limit` running at once, keeping the
// order of the results. One failure rejects the whole run, like Promise.all.
export const runLimited = async (tasks, limit = 4) => {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
};

export default runLimited;
