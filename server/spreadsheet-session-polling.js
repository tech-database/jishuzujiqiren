export async function pollPendingSpreadsheetSessions({
  sessions,
  now = Date.now(),
  listCompletions,
  handleCompletion,
  onRecovered = () => {},
  onError = () => {},
}) {
  for (const [key, pending] of [...sessions.entries()]) {
    if (pending.expiresAt < now) {
      sessions.delete(key);
      continue;
    }

    try {
      const chatId = pending.chatId || key;
      const completions = await listCompletions(chatId, pending);
      if (completions.length === 0) continue;

      const completion = completions[completions.length - 1];
      onRecovered(key, completion);
      await handleCompletion(completion, pending);
    } catch (error) {
      try {
        onError(error, key, pending);
      } catch {
        // Error reporting must not prevent the remaining sessions from being polled.
      }
    }
  }
}
