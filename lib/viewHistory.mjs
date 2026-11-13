const MAX_POSITIONS = 100;

export function createViewHistory() {
  const past = [];
  const future = [];

  return {
    push(position) {
      future.length = 0;
      const previous = past.at(-1);
      // PDF.js captures the same view twice before a link jump.
      if (
        previous?.page === position.page &&
        previous.top === position.top &&
        previous.left === position.left
      ) {
        return;
      }
      past.push({ ...position });
      if (past.length > MAX_POSITIONS) {
        past.shift();
      }
    },
    back(current) {
      if (!past.length) {
        return null;
      }
      future.push({ ...current });
      return past.pop();
    },
    forward(current) {
      if (!future.length) {
        return null;
      }
      past.push({ ...current });
      return future.pop();
    },
    clear() {
      past.length = 0;
      future.length = 0;
    },
    canGoBack() {
      return past.length > 0;
    },
    canGoForward() {
      return future.length > 0;
    },
  };
}
