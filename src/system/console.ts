import process from 'process';
import {Command} from 'commander';

export class Console {
  private target: string;
  private readonly opts: Record<string, any>;

  constructor() {
    const program: Command = new Command();

    program
      .option('-e, --env-file <file>', 'ENVFILE')
      .option('-i, --input <value...>', 'set env variables: SB_INPUT, SB_INPUT1, SB_INPUT2, ...')
      .option('-u, --update', 'self update')
      .option('-v, --version', 'version')
      .option('-d, --debug', 'disables command execution')
      .option('-L, --list', 'helper from BASH autocomplete')
      .arguments('[target]')
      .action((target: string = 'main') => {
        this.target = target;
      });

    program.parse(process.argv);
    this.opts = program.opts();

    const input: string[] = this.getField('input');

    if (input) {
      input.forEach((value: string, index: number) => {
        process.env[`SB_INPUT${0 === index ? '' : index}`] = value;
      });
    }
  }

  public getField<T>(field: string, defaultValue?: T): T {
    return this.opts[field] ?? defaultValue;
  }

  public getTarget(): string {
    return this.target;
  }
}