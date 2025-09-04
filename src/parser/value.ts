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
        case 'fn.Split':
          return this.fnSplit(value);
        case 'fn.UpVersion':
          return this.fnUpVersion(value);
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
    const options: any = this.app.getOptions(data);
    const items: string[] = await this.fs.glob(this.app.getFullPath(Utils.first(options.data), options.cwd));
    const path: string = items ? items[0] || '' : '';

    if (path) {
      return this.app.getFullPath(path, options.cwd);
    }

    return '';
  }

  private async fnGitFindBranch(data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    const find: string = Utils.first(options.data);

    const branch: string[] = Utils.natsort(
      (await this.app.getCommand().exec(['git', 'branch', '-a'], options.cwd))
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

    for (const item of branch) {
      if (-1 !== item.indexOf(find)) {
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
    const options: any = this.app.getOptions(data);
    const file: string = this.app.getFullPath(options.data[0], options.cwd);
    const path: string[] = data[1];

    return _.get(await this.fs.readXmlFile(file), path);
  }

  private async fnJson(data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    const file: string = this.app.getFullPath(options.data[0], options.cwd);
    const path: string[] = data[1];

    return _.get(await this.fs.readJsonFile(file), path);
  }

  private async fnIni(data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    const file: string = this.app.getFullPath(options.data[0], options.cwd);
    const path: string[] = data[1];

    return _.get(await this.fs.readIniFile(file), path);
  }

  private async fnGitConfig(data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    const file: string = this.app.getFullPath(options.data[0], options.cwd);
    const path: string[] = data[1];

    return _.get(await this.fs.readGitConfigFile(file), path);
  }

  private async fnYaml(data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    const file: string = this.app.getFullPath(options.data[0], options.cwd);
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
    const options: any = this.app.getOptions(data);
    return options.data.join(options.separator ?? '');
  }

  private async fnSplit(data: any[]): Promise<string> {
    const options: any = this.app.getOptions(data);
    let value: string = Utils.first(options.data);
    let separator: string = options.separator;
    let section: number = Utils.toInt(options.section);

    return value.split(separator)[section] || '';
  }

  private async fnUpVersion(data: any[]): Promise<string> {
    const options: any = this.app.getOptions(data);
    let value: string = String(Utils.first(options.data));
    let separator: string = options.separator || '.';
    let section: number = Utils.toInt(options.section);

    let chunks: string[] = value.split(separator);
    chunks[section] = String(Utils.toInt(chunks[section]) + 1);

    return chunks.join(separator);
  }

  private async fnFsSize(data: any): Promise<number> {
    if (!data) {
      return 0;
    }

    const options: any = this.app.getOptions(data);
    const path: string = this.app.getFullPath(Utils.first(options.data), options.cwd);

    return this.fs.size(path);
  }

  private async fnFsBasename(data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    const path: string = this.app.getFullPath(Utils.first(options.data), options.cwd);

    return this.fs.basename(path);
  }

  private async fnFsDirname(data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    const path: string = this.app.getFullPath(Utils.first(options.data), options.cwd);

    return this.fs.dirname(path);
  }

  private async anyFn(cmd: any[], data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    return await this.app.getCommand().exec([...cmd, ...options.data], options.cwd);
  }
}