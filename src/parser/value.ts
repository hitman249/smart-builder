import type {App} from "../app";
import _ from "lodash";
import Utils from "../helpers/utils";
import type FileSystem from "../fs/file-system";

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
        case 'fn.git.BranchName':
          return this.fnGit(['rev-parse', '--abbrev-ref', 'HEAD', ...value]);
        case 'fn.git.Count':
          return this.fnGit(['rev-parse', '--count', 'HEAD', ...value]);
        case 'fn.git.FindBranch':
          return this.fnGitFindBranch(value);
        case 'fn.git.Config':
          return this.fnGitConfig(value);
        case 'fn.Glob':
          return this.fnGlob(value);
        case 'fn.Sh':
          return this.fnSh(value);
        case 'fn.Xml':
          return this.fnXml(value);
        case 'fn.Json':
          return this.fnJson(value);
        case 'fn.Ini':
          return this.fnIni(value);
        case 'fn.Yaml':
          return this.fnYaml(value);
        case 'fn.If':
          return this.fnIf(value);
        case 'fn.Join':
          return this.fnJoin(value);
        case 'fn.math.Sum':
          return this.fnMathSum(value);
        case 'fn.math.Sub':
          return this.fnMathSub(value);
        case 'fn.math.Div':
          return this.fnMathDiv(value);
        case 'fn.math.Trunc':
          return this.fnMathTrunc(value);
        case 'fn.math.Multiplication':
          return this.fnMathMultiplication(value);
        case 'fn.fs.Size':
          return this.fnFsSize(value);
        case 'fn.fs.Basename':
          return this.fnFsBasename(value);
        case 'fn.fs.Dirname':
          return this.fnFsDirname(value);
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
    const file: string = '/' === data[0][0] ? data[0] : `${this.app.getRootPath()}/${data[0]}`;
    const path: string[] = data[1];

    return _.get(await this.fs.readXmlFile(file), path);
  }

  private async fnJson(data: any): Promise<string> {
    const file: string = '/' === data[0][0] ? data[0] : `${this.app.getRootPath()}/${data[0]}`;
    const path: string[] = data[1];

    return _.get(await this.fs.readJsonFile(file), path);
  }

  private async fnIni(data: any): Promise<string> {
    const file: string = '/' === data[0][0] ? data[0] : `${this.app.getRootPath()}/${data[0]}`;
    const path: string[] = data[1];

    return _.get(await this.fs.readIniFile(file), path);
  }

  private async fnGitConfig(data: any): Promise<string> {
    const file: string = '/' === data[0][0] ? data[0] : `${this.app.getRootPath()}/${data[0]}`;
    const path: string[] = data[1];

    return _.get(await this.fs.readGitConfigFile(file), path);
  }

  private async fnYaml(data: any): Promise<string> {
    const file: string = '/' === data[0][0] ? data[0] : `${this.app.getRootPath()}/${data[0]}`;
    const path: string[] = data[1];

    return _.get(await this.fs.readYamlFile(file), path);
  }

  private async fnIf(data: any): Promise<string> {
    return Utils.isTrue(data[0]) ? data[1] : data[2];
  }

  private async fnMathSum(data: any[]): Promise<number> {
    let result: number = 0;

    data.forEach((digit: string): void => {
      result += Utils.toInt(digit);
    });

    return result;
  }

  private async fnMathSub(data: any[]): Promise<number> {
    return Utils.toInt(data[0]) - Utils.toInt(data[1]);
  }

  private async fnMathDiv(data: any[]): Promise<number> {
    const a: number = Utils.toInt(data[0]);
    const b: number = Utils.toInt(data[1]);

    if (0 === b) {
      return 0;
    }

    return a / b;
  }

  private async fnMathTrunc(data: any): Promise<number> {
    return Utils.toInt(data);
  }

  private async fnMathMultiplication(data: any[]): Promise<number> {
    return Utils.toInt(data[0]) * Utils.toInt(data[1]);
  }

  private async fnJoin(data: any[]): Promise<string> {
    let separator: string = '';
    let last: string | { separator: string } = data[data.length - 1];
    let items: string[] = data;

    if ('object' === typeof last && last?.separator) {
      separator = last?.separator;
      items = data.slice(0, -1);
    }

    return items.join(separator);
  }

  private async fnFsSize(data: any): Promise<number> {
    const path: string = '/' === data[0] ? data : `${this.app.getRootPath()}/${data[0]}`;
    return this.fs.size(path);
  }

  private async fnFsBasename(data: any): Promise<string> {
    const path: string = '/' === data[0] ? data : `${this.app.getRootPath()}/${data[0]}`;
    return this.fs.basename(path);
  }

  private async fnFsDirname(data: any): Promise<string> {
    const path: string = '/' === data[0] ? data : `${this.app.getRootPath()}/${data[0]}`;
    return this.fs.dirname(path);
  }

  private async anyFn(cmd: any[], data: any): Promise<string> {
    const cwd = this.app.getCwd(data);
    return await this.app.getCommand().exec([...cmd, ...cwd.data], cwd.cwd);
  }
}