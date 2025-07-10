#!/usr/bin/env node

import process from 'process';
import path from "path";
import {Env} from "./system/env";
import Command from "./system/command";
import Finder from "./parser/finder";
import {Console} from "./system/console";
import Step from "./parser/step";
import Value from "./parser/value";
import Task from "./parser/task";
import FileSystem from "./fs/file-system";
import Network from "./system/network";

const BUILD_RULES_DIR: string = '.smart-builder';

export class App {
  private readonly rootPath: string = process.cwd();
  private readonly sbPath: string = path.join(__dirname, '../..');

  private ENV: Env;
  private COMMAND: Command;
  private CONSOLE: Console;
  private FILE_SYSTEM: FileSystem;
  private FINDER: Finder;
  private NETWORK: Network;

  public async init(): Promise<void> {
    this.COMMAND = new Command();
    this.FINDER = new Finder(`${this.rootPath}/${BUILD_RULES_DIR}`);
    await this.FINDER.init();
    this.CONSOLE = new Console();
    this.FILE_SYSTEM = new FileSystem();
    this.NETWORK = new Network();
    this.ENV = new Env(this.rootPath, this.CONSOLE.getField('envFile', '.env'));
    await this.ENV.init();

    const target: string = this.CONSOLE.getTarget();
    const update: boolean = this.CONSOLE.getField('update', false);
    const version: boolean = this.CONSOLE.getField('version', false);
    const showList: boolean = this.CONSOLE.getField('list', false);

    if (update) {
      await this.getCommand().watch(['git', 'pull'], this.sbPath).wait();
      await this.getCommand().watch(['npm', 'i'], this.sbPath).wait();
      await this.getCommand().watch(['npm', 'run', 'build'], this.sbPath).wait();
      return;
    }

    if (version) {
      console.log('version:', await this.getVersion());
      return;
    }

    if (showList) {
      for (const item of this.FINDER.getList()) {
        console.log(item);
      }

      return;
    }

    await this.run(target);
  }

  public async getVersion(): Promise<string> {
    const info: any = await this.getFileSystem().readJsonFile(`${this.sbPath}/package.json`);
    return info?.['version'];
  }

  public async run(target: string): Promise<void> {
    const doc: any = this.FINDER.getDocsByTarget(target);

    if (!doc) {
      console.log(`Target "${target}" not found.`);

      this.FINDER.getListTargetsBy(target).forEach((item: string, index: number) => {
        if (0 === index) {
          console.log('');
        }

        console.log(item);
      });

      return;
    }

    const task: Task = new Task(this, doc, target);
    await task.init();

    if (!task.checkEnvFieldsRequired()) {
      console.log(`Task "${target}". Mandatory ENV variables not set.`);
      return;
    }

    await task.run();
  }

  public getRootPath(): string {
    return this.rootPath;
  }

  public createStep(value: any): Step {
    return new Step(this, value);
  }

  public async hydrateData<T>(data: T): Promise<T> {
    return await (new Value(this, data)).get() as Promise<T>;
  }

  public getEnv(): Env {
    return this.ENV;
  }

  public getConsole(): Console {
    return this.CONSOLE;
  }

  public getFinder(): Finder {
    return this.FINDER;
  }

  public getCommand(): Command {
    return this.COMMAND;
  }

  public getFileSystem(): FileSystem {
    return this.FILE_SYSTEM;
  }

  public getNetwork(): Network {
    return this.NETWORK;
  }

  public getCwd(data: any): { data: any, cwd: string | undefined } {
    if (Array.isArray(data)) {
      let last: any = data[data.length - 1];
      let cwd: string = last?.cwd;

      if (cwd) {
        return { data: data.slice(0, -1), cwd: '/' === cwd[0] ? cwd :`${this.rootPath}/${cwd}`};
      }
    }
    return { data: data, cwd: undefined };
  }
}

declare global {
  var $app: App;
}

global.$app = new App();
global.$app.init();