import type {App} from "../app";
import _ from "lodash";
import Utils from "../helpers/utils";
import type FileSystem from "../fs/file-system";
import xml2js from 'xml2js';

export default class Value {
  private readonly app: App;
  private readonly data: any;
  private readonly fs: FileSystem;

  constructor(app: App, data: any) {
    this.app = app;
    this.data = data;
    this.fs = this.app.getFileSystem();
  }

  public async get(): Promise<any> {
    if (_.isString(this.data)) {
      return this.app.getEnv().getHydrateValue(this.data);
    }

    if (Utils.isEmpty(this.data)) {
      return this.data;
    }

    if (Array.isArray(this.data)) {
      return this.enumArray(this.data);
    } else if ('object' === typeof this.data) {
      const hydrateData: any = await this.enumObject(this.data);
      const rule: string = Object.keys(hydrateData)[0];
      const value: any = hydrateData[rule];

      switch (rule) {
        case 'fn.Git':
          return this.fnGit(value);
        case 'fn.GitFindBranch':
          return this.fnGitFindBranch(value);
        case 'fn.Glob':
          return this.fnGlob(value);
        case 'fn.Sh':
          return this.fnSh(value);
        case 'fn.Xml':
          return this.fnXml(value);
      }

      return hydrateData;
    }

    return this.data;
  }

  private async enumArray(data: any): Promise<any[]> {
    const result: any[] = [];

    for (const node of data) {
      result.push(await this.app.hydrateData(node));
    }

    return result;
  }

  private async enumObject(data: any): Promise<any> {
    const result: any = {};

    for (const field of Object.keys(data)) {
      result[field] = await this.app.hydrateData(data[field]);
    }

    return result;
  }

  private async fnGlob(data: any): Promise<string> {
    const items: string[] = await this.fs.glob(Array.isArray(data) ? data[0]: data);
    const path: string = items ? items[0] || '' : '';

    if (path) {
      return '/' !== path[0] ? `${this.app.getRootPath()}/${path}` : path;
    }

    return '';
  }

  private async fnGitFindBranch(data: any): Promise<string> {
    const cwd = this.app.getCwd(data);
    const find: string = Array.isArray(cwd.data) ? cwd.data[0]: cwd.data;

    const branch: string[] = Utils.natsort(
      (await this.app.getCommand().exec(['git', 'branch', '-a'], cwd.cwd))
        .split('\n')
        .filter((n: string): boolean => -1 === n.indexOf('->'))
        .map((n: string): string => n.split('origin/').slice(1).join('origin/')),
      true
    );

    if (-1 !== branch.indexOf(find)) {
      return find;
    }

    for (const item of branch) {
      if (0 === item.indexOf(find)) {
        return item;
      }
    }

    return find;
  }

  private async fnGit(data: any): Promise<string> {
    return this.anyFn(['git'], data);
  }

  private async fnSh(data: any): Promise<string> {
    return this.anyFn(data, []);
  }

  private async fnXml(data: any): Promise<string> {
    const file: string = '/' === data[0] ? data[0] : `${this.app.getRootPath()}/${data[0]}`;
    const path: string[] = data[1];
    const xml: any = await xml2js.parseStringPromise(await this.fs.fileGetContents(file));

    return _.get(xml, path);
  }

  private async anyFn(cmd: any[], data: any): Promise<string> {
    const cwd = this.app.getCwd(data);
    return await this.app.getCommand().exec([...cmd, ...cwd.data], cwd.cwd);
  }
}