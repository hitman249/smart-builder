import process from 'process';
import child_process from 'child_process';
import type {ExecException} from 'child_process';
import WatchProcess from '../helpers/watch-process';

export default class Command {
  private static instance: Command;
  private declare locale: string;

  constructor() {
    if (Command.instance) {
      return Command.instance;
    }

    Command.instance = this;
    return Command.instance;
  }

  public async init(): Promise<any> {
  }

  public async exec(cmd: string[], cwd?: string): Promise<string> {
    return await new Promise<string>((resolve: (value: string) => void): void => {
      child_process.exec(
        `sh -c '${cwd ? `cd "${cwd}" && ` : ''} ${this.joinArgs(cmd)}'`,
        { env: process.env },
        (error: ExecException, stdout: string): void => resolve(String(stdout).trim()));
    });
  }

  public async execOfBuffer(cmd: string): Promise<Buffer> {
    return await new Promise<Buffer>((resolve: (value: Buffer) => void): void => {
      child_process.exec(cmd, {encoding: 'buffer', env: process.env}, (error: ExecException, stdout: Buffer): void => resolve(stdout));
    });
  }

  public watch(cmd: string[], cwd?: string): WatchProcess {
    return new WatchProcess(
      child_process.spawn('sh', ['-c', `${cwd ? `cd "${cwd}" && ` : ''} ${this.joinArgs(cmd)}`], {
        env: process.env,
        stdio: 'inherit',
        // detached: true,
      }),
    );
  }

  private joinArgs(cmd: string[]): string {
    return cmd.map((n: string) => -1 === ['|', '>', '>>', '&', '&&', '||'].indexOf(n) ? `"${n}"` : n).join(' ');
  }

  public addSlashes(cmd: string): string {
    return cmd.split('\\').join('\\\\').split('"').join('\\"');
  }
}