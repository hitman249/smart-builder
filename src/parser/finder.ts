import Utils from "../helpers/utils";
import _ from "lodash";
import FileSystem from "../fs/file-system";

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
    let platforms: string[] = this.prepareList(Object.keys(this.docs));

    list.push(...platforms);

    for (const platform of platforms) {
      skip.push(`${platform}:default`);

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

    return this.prepareList(list.filter((item: string) => -1 === skip.indexOf(item)));
  }

  private prepareList(items: string[]): string[] {
    return items.filter(
      (n: string): boolean => !Utils.endsWith(n, '.yaml') && -1 === n.indexOf(':_') && '_' !== n[0]
    );
  }

  public getListTargetsBy(target: string = ''): string[] {
    const [platform, task]: string[] = target.split(':');

    if (undefined === this.docs[platform]) {
      return this.prepareList(this.filterByName(platform, Object.keys(this.docs)));
    }

    let result: string[] = [];
    this.docs[platform].forEach((item: Doc) => result.push(...Object.keys(item.doc)));

    return this.prepareList(this.filterByName(task, result));
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
      const [platform, section]: string[] = (file.slice(prefixLength) || '').split('/');
      this.appendPlatform(platform, section || platform, await fs.readYamlFile(file));
    }
  }
}