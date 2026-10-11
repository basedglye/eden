#!/usr/bin/env node
export type Command = 'init' | 'start' | 'snapshot' | 'restore' | 'register';

const COMMANDS: readonly Command[] = ['init', 'start', 'snapshot', 'restore', 'register'];

export async function run(argv: string[]): Promise<number> {
  const cmd = argv[0] as Command | undefined;
  if (!cmd || !COMMANDS.includes(cmd)) {
    console.error(`usage: eden <${COMMANDS.join('|')}>`);
    return 1;
  }
  // TODO: implement each command
  console.error(`eden ${cmd}: not implemented`);
  return 1;
}

process.exitCode = await run(process.argv.slice(2));
