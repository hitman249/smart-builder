import _ from 'lodash';
import path from 'path';
import {glob} from 'glob';
import fs, {type WriteFileOptions, type Stats} from 'fs';
import Utils from '../helpers/utils';
import CopyDir, {CopyDirEvent, type Options} from './copy-dir';
import CopyFile, {CopyFileEvent} from './copy-file';
import Network from "../system/network";
import xml2js from "xml2js";
import jsyaml from "js-yaml";

export type Progress = {
  success: boolean,
  progress: number,
  totalBytes: number,
  transferredBytes: number,
  totalBytesFormatted: string,
  transferredBytesFormatted: string,
  path?: string,
  name?: string,
  itemsCount?: number,
  itemsComplete?: number,
  event?: 'copy' | 'extract' | 'packing' | 'download' | 'prefix',
};

export default class FileSystem {
  private DEFAULT_MODE_FILE: number = 0o644;
  private DEFAULT_MODE_DIR: number = 0o755;
  private FILE_APPEND: string = 'a';

  public async init(): Promise<any> {
  }

  public async exists(path: string): Promise<boolean> {
    return await new Promise((resolve: (exists: boolean) => void): void => {
      fs.access(_.trimEnd(path, '/'), (err: NodeJS.ErrnoException): void => resolve(!err));
    });
  }

  public async isDirectory(path: string): Promise<boolean> {
    return await new Promise((resolve: (value: boolean) => void): void => {
      fs.stat(_.trimEnd(path, '/'), (err: NodeJS.ErrnoException, stats: Stats): void => {
        if (err) {
          return resolve(false);
        }

        resolve(stats.isDirectory());
      });
    });
  }

  public async isFile(path: string): Promise<boolean> {
    return await new Promise((resolve: (value: boolean) => void): void => {
      fs.lstat(_.trimEnd(path, '/'), (err: NodeJS.ErrnoException, stats: Stats): void => {
        if (err) {
          return resolve(false);
        }

        resolve(stats.isFile());
      });
    });
  }

  public async isSymbolicLink(path: string): Promise<boolean> {
    return await new Promise((resolve: (value: boolean) => void): void => {
      fs.lstat(_.trimEnd(path, '/'), (err: NodeJS.ErrnoException, stats: Stats): void => {
        if (err) {
          return resolve(false);
        }

        resolve(stats.isSymbolicLink());
      });
    });
  }

  public async getCreateDate(path: string): Promise<Date> {
    return await new Promise((resolve: (value: Date) => void, reject: (err: any) => void): void => {
      fs.lstat(_.trimEnd(path, '/'), (err: NodeJS.ErrnoException, stats: Stats): void => {
        if (err) {
          return reject(err);
        }

        resolve(stats.ctime);
      });
    });
  }

  public async mkdir(path: string): Promise<boolean> {
    return await this.exists(path)
      .then((exists: boolean): Promise<boolean> => {
        if (exists) {
          return;
        }

        return new Promise<boolean>((resolve: (value: boolean) => void): void => {
          const pathDir: string = _.trimEnd(path, '/');

          fs.mkdir(pathDir, {recursive: true, mode: this.DEFAULT_MODE_DIR}, (err: NodeJS.ErrnoException): void => {
            if (err) {
              return resolve(false);
            }

            resolve(true);
          });
        });
      });
  }

  public async size(path: string): Promise<number> {
    if (!await this.exists(path)) {
      return 0;
    }

    if (await this.isDirectory(path) && !await this.isSymbolicLink(path)) {
      return (await this.directoryAnalysis(path)).getSize();
    }

    return await new CopyFile(this, path).getSize();
  }

  public async directoryAnalysis(path: string): Promise<CopyDir> {
    return new CopyDir(this, path);
  }

  public async rm(path: string): Promise<boolean> {
    path = _.trimEnd(path, '/');

    if (await this.isFile(path) || await this.isSymbolicLink(path)) {
      return await new Promise((resolve: (value: boolean) => void) => {
        fs.unlink(path, (err: NodeJS.ErrnoException) => {
          if (err) {
            resolve(false);
          }

          resolve(true);
        });
      });
    }

    return await new Promise((resolve: (value: boolean) => void) => {
      fs.rm(path, {recursive: true, force: true}, (err: NodeJS.ErrnoException) => {
        if (err) {
          resolve(false);
        }

        resolve(true);
      });
    });
  }

  public async mv(src: string, dest: string, options?: Options, callback?: (progress: Progress) => void): Promise<void> {
    if (await this.isDirectory(src)) {
      const copyDir: CopyDir = new CopyDir(this, src, dest);
      copyDir.on(
        CopyDirEvent.PROGRESS,
        (event: CopyDirEvent.PROGRESS, progress: Progress) => callback ? callback(progress) : undefined,
      );

      return copyDir.move(options);
    }

    const copyFile: CopyFile = new CopyFile(this, src, dest);
    copyFile.on(
      CopyFileEvent.PROGRESS,
      (event: CopyDirEvent.PROGRESS, progress: Progress) => callback ? callback(progress) : undefined,
    );

    return copyFile.move(options);
  }

  public async cp(src: string, dest: string, options?: Options, callback?: (progress: Progress) => void): Promise<void> {
    if (await this.isDirectory(src)) {
      const copyDir: CopyDir = new CopyDir(this, src, dest);
      copyDir.on(
        CopyDirEvent.PROGRESS,
        (event: CopyDirEvent.PROGRESS, progress: Progress) => callback ? callback(progress) : undefined,
      );

      return copyDir.copy(options);
    }

    const copyFile: CopyFile = new CopyFile(this, src, dest);
    copyFile.on(
      CopyFileEvent.PROGRESS,
      (event: CopyDirEvent.PROGRESS, progress: Progress) => callback ? callback(progress) : undefined,
    );

    return copyFile.copy(options);
  }

  public async resetFileTimestamps(path: string): Promise<boolean> {
    return await new Promise<boolean>((resolve: (value: boolean) => void) => {
      fs.open(path, 'r+', path, (err: NodeJS.ErrnoException, fd: number): void => {
        if (err) {
          return resolve(false);
        }

        fs.futimes(fd, Date.now(), Date.now(), (err: NodeJS.ErrnoException) => {
          if (err) {
            return resolve(false);
          }

          return resolve(true);
        });
      });
    });
  }

  public async glob(path: string, options: {} = {}): Promise<string[]> {
    return await glob(path, {dot: true, ...options});
  }

  public async readFile(pathOrUrl: string, autoEncoding: boolean = false): Promise<string> {
    const isUrl: boolean = 0 === pathOrUrl.indexOf('http:') || 0 === pathOrUrl.indexOf('https:');

    if (isUrl) {
      const network: Network = new Network();
      return network.get(pathOrUrl);
    }

    return this.fileGetContents(pathOrUrl, autoEncoding);
  }

  public async saveFile(path: string, data: string | Buffer): Promise<void> {
    return this.filePutContents(path, data);
  }

  public async readJsonFile(pathOrUrl: string, autoEncoding: boolean = false): Promise<any> {
    return Utils.jsonDecode(await this.readFile(pathOrUrl, autoEncoding));
  }

  public async saveJsonFile(path: string, data: Object): Promise<void> {
    return this.saveFile(path, Utils.jsonEncode(data));
  }

  public async readXmlFile(pathOrUrl: string, autoEncoding: boolean = false): Promise<any> {
    return await xml2js.parseStringPromise(await this.readFile(pathOrUrl, autoEncoding));
  }

  public async saveXmlFile(path: string, data: Object): Promise<void> {
    return this.saveFile(path, (new xml2js.Builder()).buildObject(data));
  }

  public async readYamlFile(pathOrUrl: string, autoEncoding: boolean = false): Promise<any> {
    return jsyaml.load(await this.readFile(pathOrUrl, autoEncoding));
  }

  public async saveYamlFile(path: string, data: Object): Promise<void> {
    return this.saveFile(path, jsyaml.dump(data));
  }

  public async fileGetContents(filepath: string, autoEncoding: boolean = false): Promise<string> {
    return await new Promise((resolve: (value: string) => void, reject: (err: any) => void) => {
      fs.readFile(filepath, (err: NodeJS.ErrnoException, buffer: Buffer) => {
        if (err) {
          reject(err);
        }

        if (autoEncoding) {
          return resolve(Utils.normalize(buffer));
        }

        return resolve(buffer.toString());
      });
    });
  }

  public async fileGetContentsByEncoding(filepath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return await new Promise((resolve: (value: string) => void, reject: (err: any) => void) => {
      fs.readFile(filepath, {encoding}, (err: NodeJS.ErrnoException, buffer: Buffer) => {
        if (err) {
          return reject(err);
        }

        return resolve(buffer.toString());
      });
    });
  }

  public async filePutContents(filepath: string, data: string | Buffer, flag?: string): Promise<void> {
    return await new Promise((resolve: (value: void) => void, reject: (err: any) => void) => {
      const options: WriteFileOptions = Object.assign(
        {mode: this.DEFAULT_MODE_FILE},
        flag ? {flag} : {},
      );

      fs.writeFile(filepath, data, options, (err: NodeJS.ErrnoException) => {
        if (err) {
          return reject(err);
        }

        return resolve();
      });
    });
  }

  public async readSymbolicLink(path: string): Promise<string | undefined> {
    return new Promise((resolve: (path: string) => void): void => {
      fs.readlink(path, (err: NodeJS.ErrnoException, target: string): void => {
        if (!err) {
          resolve(target);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  public async isEmptyDir(path: string): Promise<boolean> {
    return (await this.glob(`${_.trimEnd(path, '/')}/*`)).length === 0;
  }

  public dirname(src: string): string {
    return path.dirname(src);
  }

  public basename(src: string): string {
    return path.basename(src);
  }

  public extension(src: string): string {
    return _.trimStart(path.extname(src), '.');
  }
}