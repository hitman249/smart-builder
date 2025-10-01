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
import Utils from "./helpers/utils";

export type Options = {
  data?: string[] | string,
  cwd?: string,
  ignoreError?: boolean,
};

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
    this.ENV = new Env(this.rootPath, this.CONSOLE.getField('envFile', '.sb.env'));
    await this.ENV.init();

    const appVersion: string = await this.getVersion();
    const configsInfo: any = this.FINDER.getRootDoc('smart-builder.yaml');
    const minVersion: string = configsInfo?.[0]?.doc?.min_version;

    if (minVersion) {
      if (!Utils.versionCompare(appVersion, minVersion, '>=')) {
        console.log('');
        console.log('It is required to update Smart-Builder.');
        console.log('');
        console.log(`Smart-Builder version:    ${appVersion}`);
        console.log(`Minimum required version: ${minVersion}`);
        console.log('');
        console.log('Launch a command to upgrade:');
        console.log('');
        console.log('smart-builder -u');
        console.log('');
        return;
      }
    }

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
      console.log('version:', appVersion);
      return;
    }

    if (showList) {
      for (const item of this.FINDER.getList()) {
        console.log(item);
      }

      return;
    }

    const [platform = 'main']: string[] = target.split(':');

    await this.run('main:_before_');

    if ('main' !== platform) {
      await this.run(`${platform}:_before_`);
    }

    await this.run(target);

    if ('main' !== platform) {
      await this.run(`${platform}:_after_`);
    }

    await this.run('main:_after_');
  }

  public isDebug(): boolean {
    return this.CONSOLE.getField('debug', false);
  }

  public async getVersion(): Promise<string> {
    const info: any = await this.getFileSystem().readJsonFile(`${this.sbPath}/package.json`);
    return info?.['version'];
  }

  public async run(target: string): Promise<void> {
    const [, task = 'default']: string[] = target.split(':');
    const doc: any = this.FINDER.getDocsByTarget(target);

    if (!doc) {
      if ('_before_' === task || '_after_' === task) {
        return;
      }

      console.log(`Target "${target}" not found.`);

      this.FINDER.getListTargetsBy(target).forEach((item: string, index: number) => {
        if (0 === index) {
          console.log('');
        }

        console.log(item);
      });

      return;
    }

    const runner: Task = new Task(this, doc, target);
    await runner.init();

    if (!runner.checkEnvFieldsRequired()) {
      console.log(`Task "${target}". Mandatory ENV variables not set.`);
      return;
    }

    await runner.run();
  }

  public getRootPath(): string {
    return this.rootPath;
  }

  public getFullPath(path: string, cwd?: string): string {
    const prefix: string = cwd ? (Utils.isFullPath(cwd) ? cwd : `${this.rootPath}/${cwd}`) : this.rootPath;
    return Utils.isFullPath(path) ? path : `${prefix}/${path}`;
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

  public getOptions(data: any): Options {
    const types: {[type: string]: (keyof Options)[]} = {
      path: [
        'cwd',
      ],
    };

    const result: any = {};

    if (Array.isArray(data)) {
      let lastIndex: number = 0;

      for (let i: number = data.length - 1; i >= 0; i--) {
        let last: any = data[i];

        if (!Utils.isEmpty(last) && 'object' === typeof last && !Array.isArray(last)) {
          lastIndex++;

          Object.keys(last).forEach((variable: keyof Options) => {
            const value: any = last[variable];

            if (-1 !== types.path.indexOf(variable)) {
              result[variable] = this.getFullPath(value);
            } else {
              result[variable] = value;
            }
          });

          continue;
        }

        break;
      }

      if (lastIndex > 0) {
        data = data.slice(0, -lastIndex);
      }
    }

    result['data'] = data;

    return result;
  }
}

declare global {
  var $app: App;
}

global.$app = new App();
global.$app.init();