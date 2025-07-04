import Utils from "../helpers/utils";
import _ from "lodash";
import FileSystem from "../fs/file-system";
import jsyaml from "js-yaml";

type Doc = { doc: any, file: string };
type Platforms = { [platform: string]: Doc[] };

export default class Finder {
  private readonly path: string;
  private docs: Platforms = {};

  constructor(path: string) {
    this.path = path;
  }

  public async init(): Promise<void> {
    await this.load();
  }

  public getDocsByTarget(target: string = 'main'): Doc['doc'] {
    const [platform = 'main', task = 'default']: string[] = target.split(':');

    if (!this.docs[platform]) {
      return;
    }

    for (const doc of this.docs[platform]) {
      for (const key of Object.keys(doc.doc)) {
        if (key === task) {
          return doc.doc[task];
        }
      }
    }
  }

  public getList(): string[] {
    let list: string[] = [];
    let skip: string[] = [];
    let platforms: string[] = Object.keys(this.docs).filter((n: string) => !Utils.endsWith(n, '.yaml'));

    list.push(...platforms);

    for (const platform of platforms) {
      for (const doc of this.docs[platform]) {
        const docs: string[] = Object.keys(doc.doc);
        for (const item of docs) {
          if (false === doc.doc[item]?.autocomplete) {
            skip.push(`${platform}:${item}`);
          }
        }

        list.push(...docs.map((target: string) => `${platform}:${target}`));
      }
    }

    return list.filter((item: string) => -1 === skip.indexOf(item));
  }

  public getListTargetsBy(target: string = ''): string[] {
    const [platform, task]: string[] = target.split(':');

    if (undefined === this.docs[platform]) {
      return this.filterByName(platform, Object.keys(this.docs)
        .filter((n) => !Utils.endsWith(n, '.yaml')));
    }

    let result: string[] = [];
    this.docs[platform].forEach((item: Doc) => result.push(...Object.keys(item.doc)));

    return this.filterByName(task, result);
  }

  public filterByName(name: string, targets: string[]): string[] {
    let start: string[] = targets;
    let i: number = 0;

    while (1) {
      let next: string[] = start.filter((n: string) => n[i] === name[i]);

      if (next.length > 0) {
        start = next;
        i++;
      } else {
        break;
      }

      if (i > name.length) {
        break;
      }
    }

    return start;
  }

  public appendPlatform(platform: string, file: string, doc: any): void {
    if (!doc) {
      return;
    }

    if (undefined === this.docs[platform]) {
      this.docs[platform] = [];
    }

    for (const task of Object.keys(doc)) {
      if (doc[task].steps) {
        for (let i: number = 0, max: number = doc[task].steps.length; i < max; i++) {
          if (_.isString(doc[task].steps[i]) && ':' === doc[task].steps[i][0]) {
            doc[task].steps[i] = `${platform}${doc[task].steps[i]}`;
          }
        }
      }
    }

    this.docs[platform].push({file: file, doc: doc});
  }

  public async load(): Promise<void> {
    const prefixLength: number = this.path.length + 1;
    const fs: FileSystem = new FileSystem();
    const files: string[] = await (await fs.directoryAnalysis(this.path)).getFiles();

    for await (const file of files) {
      const doc: any = jsyaml.load(await fs.fileGetContentsByEncoding(file));
      const [platform, section]: string[] = (file.slice(prefixLength) || '').split('/');
      this.appendPlatform(platform, section || platform, doc);
    }
  }
}