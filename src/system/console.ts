import process from 'process';
import {Command} from 'commander';

export class Console {
  private target: string;
  private readonly opts: Record<string, any>;

  constructor() {
    const program: Command = new Command();

    program
      .option('-e, --env-file <file>', 'ENVFILE')
      .option('-i, --input <value>', 'Set env variable: SB_INPUT')
      .option('-L, --list', 'Helper from BASH autocomplete')
      .arguments('[target]')
      .action((target: string = 'main') => {
        this.target = target;
      });

    program.parse(process.argv);
    this.opts = program.opts();

    const input: string = this.getField('input');

    if (input) {
      process.env['SB_INPUT'] = input;
    }
  }

  public getField<T>(field: string, defaultValue?: T): T {
    return this.opts[field] ?? defaultValue;
  }

  public getTarget(): string {
    return this.target;
  }
}