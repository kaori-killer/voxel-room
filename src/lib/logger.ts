type LevelType = 'warn' | 'error';

const PREFIX = '[voxel-room]';

function emit(level: LevelType, message: string, detail?: unknown): void {
  if (process.env.NODE_ENV === 'test') return;
  const args = detail === undefined ? [PREFIX, message] : [PREFIX, message, detail];
  if (level === 'error') console.error(...args);
  else console.warn(...args);
}

export const logger = {
  warn: (message: string, detail?: unknown) => emit('warn', message, detail),
  error: (message: string, detail?: unknown) => emit('error', message, detail),
};
