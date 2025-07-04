import process from 'process';
import dotenv from 'dotenv';
import FileSystem from '../fs/file-system';
import Utils from "../helpers/utils";

interface Dict<T> { [key: string]: T | undefined; }
export interface ProcessEnv extends Dict<string> {}

export class Env {
  private readonly path: string;

  constructor(rootPath: string, file: string = '.env') {
    this.path = `${rootPath}/${file}`;
  }

  public async init(): Promise<void> {
    const fs: FileSystem = new FileSystem();

    if (await fs.exists(this.path)) {
      dotenv.config({path: this.path, override: true});
    }
  }

  public async getEnv(): Promise<ProcessEnv> {
    return process.env;
  }

  public hydrate(field: string, value: string): void {
    process.env[field] = this.getHydrateValue(value);
  }

  public getHydrateValue(text: string): string {
    const ternary: RegExp = new RegExp(/env\.([a-zA-Z_0-9]{1,})(\?(.*)\:(.*)|)/);
    const [, field, , yes, no]: string[] = text.match(ternary) as string[] || [];

    if (field) {
      if (undefined !== no) {
        return Utils.isTrue(process.env[field]) ? yes || String(process.env[field]) : no;
      } else {
        return process.env[field] || '';
      }
    }

    const anyEnvFields: RegExp = new RegExp(/\${([a-zA-Z_0-9]{1,})}/g);
    const fields: string[] = text.match(anyEnvFields) as string[] || [];

    let modifyText: string = text;

    for (const field of fields) {
      modifyText = modifyText.split(field).join(process.env[field.slice(2, -1)] || '');
    }

    return modifyText;
  }

  public isExist(field: string): boolean {
    return !Utils.isEmpty(process.env[field]);
  }
}