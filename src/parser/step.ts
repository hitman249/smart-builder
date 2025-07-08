import type {App} from "../app";
import FileSystem from "../fs/file-system";
import Utils from "../helpers/utils";
import _ from "lodash";
import process from "process";
import Network from "../system/network";
import sharp from "sharp";
import type {ResizeOptions, Sharp} from "sharp";
import {Client} from "basic-ftp";

export default class Step {
  private readonly app: App;
  private readonly data: any;
  private readonly fs: FileSystem;

  constructor(app: App, data: any) {
    this.app = app;
    this.data = data;
    this.fs = new FileSystem();
  }

  public get rootPath(): string {
    return this.app.getRootPath();
  }

  public async run(): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(this.data);

    if (_.isString(hydrateData)) {
      return this.app.run(hydrateData);
    }

    const rule: string = Object.keys(hydrateData)[0];
    const value: any = hydrateData[rule];

    switch (rule) {
      case 'load.Env':
        return this.loadEnv(value);
      case 'edit.Json':
        return this.editJson(value);
      case 'edit.Xml':
        return this.editXml(value);
      case 'edit.Yaml':
        return this.editYaml(value);
      case 'edit.Ini':
        return this.editIni(value);
      case 'edit.Text':
        return this.editText(value);
      case 'edit.Replace':
        return this.editReplace(value);
      case 'shell.Echo':
        return this.anyFn(['echo'], value);
      case 'shell.Npm':
        return this.anyFn(['npm'], value);
      case 'shell.Yarn':
        return this.anyFn(['yarn'], value);
      case 'shell.Sh':
        return this.anyFn([], value);
      case 'shell.Gulp':
        return this.anyFn(['npx', 'gulp'], value);
      case 'shell.Git':
        return this.anyFn(['git'], value);
      case 'shell.GitPull':
        return this.anyFn(['git', 'pull', 'origin', await this.fetchAnyFn(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], value)], value);
      case 'open.Url':
        return this.openUrl(value);
      case 'ares.Inspect':
        return this.anyFn(['ares-inspect'], value);
      case 'ares.Install':
        return this.anyFn(['ares-install'], value);
      case 'ares.Launch':
        return this.anyFn(['ares-launch'], value);
      case 'tizen.Install':
        return this.tizenInstall(value);
      case 'tizen.Package':
        return this.tizenPackage(value);
      case 'tizen.Run':
        return this.tizenRun(value);
      case 'tizen.Stop':
        return this.tizenStop(value);
      case 'tizen.Inspect':
        return this.tizenInspect(value);
      case 'tizen.Remove':
        return this.tizenRemove(value);
      case 'tizen.EmulatorStart':
        return this.tizenEmulatorStart(value);
      case 'vbox.Start':
        return this.anyFn(['VBoxManage', 'startvm', Utils.first(value)], []);
      case 'vbox.Pause':
        return this.anyFn(['VBoxManage', 'controlvm', Utils.first(value), 'pause'], []);
      case 'vbox.Resume':
        return this.anyFn(['VBoxManage', 'controlvm', Utils.first(value), 'resume'], []);
      case 'shell.Clean':
        return this.shellClean(value);
      case 'shell.Copy':
        return this.shellCopy(value);
      case 'shell.Mkdir':
        return this.shellMkdir(value);
      case 'console.Log':
        return this.consoleLog(value);
      case 'console.Dir':
        return this.consoleDir(value);
      case 'download.File':
        return this.downloadFile(value);
      case 'download.Png':
        return this.downloadImage(value, false);
      case 'download.Jpeg':
        return this.downloadImage(value, true);
      case 'upload.Ftp':
        return this.uploadFtp(value);
    }
  }

  private async loadEnv(data: any): Promise<void> {
    const env: string = await this.fs.readJsonFile(Utils.first(data));
    await this.app.getEnv().loadEnv(env);
  }

  private async editJson(data: any): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    const path: string = hydrateData[1];
    const value: string = hydrateData[2];

    const content: any = (await this.fs.exists(file)) ? await this.fs.readJsonFile(file) : {};
    await this.fs.saveJsonFile(file, _.set(content, path, value));
  }

  private async editXml(data: any): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    const path: string = hydrateData[1];
    const value: string = hydrateData[2];

    const content: any = (await this.fs.exists(file)) ? await this.fs.readXmlFile(file) : {};
    await this.fs.saveXmlFile(file, _.set(content, path, value));
  }

  private async editYaml(data: any): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    const path: string = hydrateData[1];
    const value: string = hydrateData[2];

    const content: any = (await this.fs.exists(file)) ? await this.fs.readYamlFile(file) : {};
    await this.fs.saveYamlFile(file, _.set(content, path, value));
  }

  private async editIni(data: any): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    const path: string = hydrateData[1];
    const value: string = hydrateData[2];

    const content: any = (await this.fs.exists(file)) ? await this.fs.readIniFile(file) : {};
    await this.fs.saveIniFile(file, _.set(content, path, value));
  }

  private async editText(data: any): Promise<void> {
    const hydrateData: string[] = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    await this.fs.saveFile(file, hydrateData.slice(1).join('\n'));
  }

  private async editReplace(data: any): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    const find: string = hydrateData[1];
    const replace: string = hydrateData[2];

    if (!await this.fs.exists(file)) {
      return;
    }

    const plainText: string = await this.fs.readFile(file);
    await this.fs.saveFile(file, plainText.split(find).join(replace));
  }

  private async openUrl(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const path: string = Utils.first(cwd.data);
    await this.app.getCommand().watch(['xdg-open', path], cwd.cwd).wait();
  }

  private async tizenInstall(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const filename: string = cwd.data[0];
    const target: string = cwd.data[1];

    await this.app.getCommand().watch([
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'install', '-n', filename, '-t', target
    ], cwd.cwd).wait();
  }

  private async tizenPackage(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const cert: string = cwd.data[0];

    await this.app.getCommand().watch([
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'package', '-t', 'wgt', '-s', cert, '--', './'
    ], cwd.cwd).wait();
  }

  private async tizenRun(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const packageId: string = cwd.data[0];
    const target: string = cwd.data[1];

    await this.app.getCommand().watch([
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'run', '-p', packageId, '-t', target
    ], cwd.cwd).wait();
  }

  private async tizenInspect(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const packageId: string = cwd.data[0];
    const DEBUG_PORT: RegExp = new RegExp(/(port(.*):\s+\d+)/g);

    const launchResult: string = await this.app.getCommand().exec([
      `${process.env.HOME}/tizen-studio/tools/sdb`, 'shell', '0', 'debug', packageId
    ], cwd.cwd);

    console.log(launchResult);

    const port: string = _.trim(launchResult.match(DEBUG_PORT)[0].split(':')[1]);

    if (port) {
      await Utils.sleep(3000);

      try {
        await this.app.getCommand().watch([
          `${process.env.HOME}/tizen-studio/tools/sdb`, 'forward', '--remove', `tcp:${port}`
        ], cwd.cwd).wait();
      } catch (e) {
      }

      await this.app.getCommand().watch([
        `${process.env.HOME}/tizen-studio/tools/sdb`, 'forward', `tcp:${port}`, `tcp:${port}`
      ], cwd.cwd).wait();

      const doc: any = await this.app.getNetwork().getJSON(`http://localhost:${port}/json`);
      const postfix: string = doc?.[0]?.['devtoolsFrontendUrl'];

      console.log(`Debug URL:`);
      console.log(`http://localhost:${port}${postfix}`);
    } else {
      console.log(`Failed to start the application in debugging mode.`);
    }
  }

  private async tizenStop(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const packageId: string = cwd.data[0];

    await this.app.getCommand().watch(
      [`${process.env.HOME}/tizen-studio/tools/sdb`, 'shell', '0', 'was_kill', packageId],
      cwd.cwd
    ).wait();
  }

  private async tizenRemove(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const packageId: string = cwd.data[0];
    const target: string = cwd.data[1];

    await this.app.getCommand().watch([
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'uninstall', '-p', packageId, '-t', target
    ], cwd.cwd).wait();
  }

  private async tizenEmulatorStart(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const platform: string = cwd.data[0];
    const target: string = cwd.data[1];

    await this.app.getCommand().watch([
      `${process.env.HOME}/tizen-studio/platforms/${platform}/tv-samsung/emulator/bin/emulator.sh`,
      '--conf',
      `${process.env.HOME}/tizen-studio-data/emulator/vms/${target}/vm_launch.conf`,
      '-j',
      `${process.env.HOME}/tizen-studio/jdk/bin/java`,
    ], cwd.cwd).wait();
  }

  private async shellClean(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const path: string = Utils.first(cwd.data);

    if (path && _.trim(this.rootPath, '/') !== _.trim(path, '/')) {
      await this.fs.rm('/' === path[0] ? path : `${this.rootPath}/${path}`);
    }
  }

  private async shellCopy(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const from: string = cwd.data[0];
    const to: string = cwd.data[1];

    if (from && _.trim(this.rootPath, '/') !== _.trim(from, '/') &&
      to && _.trim(this.rootPath, '/') !== _.trim(to, '/')) {
      await this.fs.cp(
        '/' === from[0] ? from : `${this.rootPath}/${from}`,
        '/' === to[0] ? to : `${this.rootPath}/${to}`,
      );
    }
  }

  private async shellMkdir(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    const path: string = Utils.first(cwd.data);

    if (path && _.trim(this.rootPath, '/') !== _.trim(path, '/')) {
      await this.fs.mkdir('/' === path[0] ? path : `${this.rootPath}/${path}`);
    }
  }

  private async consoleLog(data: any): Promise<void> {
    console.log(..._.castArray(data));
  }

  private async consoleDir(data: any): Promise<void> {
    console.dir(..._.castArray(data), {depth: 5});
  }

  private async downloadFile(data: any): Promise<void> {
    const url: string = data[0];
    const out: string = data[1];

    if (!url) {
      return Promise.reject(`Error download file from "${url}".`);
    }

    const network: Network = new Network();
    await network.download(url, '/' === out[0] ? out : `${this.app.getRootPath()}/${out}`);
  }

  private async downloadImage(data: any, isJpeg: boolean = false): Promise<void> {
    const fits: string[] = ['contain', 'cover', 'fill', 'inside', 'outside'];
    const url: string = data[0];
    const out: string = '/' === data[1][0] ? data[1] : `${this.app.getRootPath()}/${data[1]}`;
    let fit: ResizeOptions['fit'];
    let width: number;
    let height: number;

    if (data[2] && -1 === fits.indexOf(data[2])) {
      fit = 'inside';
      width = Utils.toInt(data[2]);
      height = Utils.toInt(data[3]) ? Utils.toInt(data[3]) : width;
    } else {
      fit = data[2];
      width = Utils.toInt(data[3]);
      height = Utils.toInt(data[4]) ? Utils.toInt(data[4]) : width;
    }

    if (!url) {
      return Promise.reject(`Error download file from "${url}".`);
    }

    const network: Network = new Network();
    await network.download(url, out);

    if (!width) {
      return;
    }

    let resize: Sharp = sharp(out).resize({fit, width, height});
    const buffer: Buffer = await (isJpeg ? resize.jpeg() : resize.png()).toBuffer();

    if (await this.fs.exists(out)) {
      await this.fs.rm(out);
    }

    await this.fs.saveFile(out, buffer);
  }

  private async uploadFtp(data: any): Promise<void> {
    if (!data?.PATH_IN || !data?.PATH_OUT || !data?.HOST) {
      return;
    }

    const fileIn: string = '/' === data?.PATH_IN[0] ? data?.PATH_IN : `${this.app.getRootPath()}/${data?.PATH_IN}`;
    const fileOut: string = data?.PATH_OUT;
    const dirOut: string = _.trim(this.fs.dirname(fileOut), '/');

    const client: Client = new Client();
    client.ftp.verbose = Utils.isTrue(data.VERBOSE);

    try {
      await client.access({
        host: data.HOST,
        user: data.USER || '',
        password: data.PASSWORD || '',
        secure: Utils.isTrue(data.SECURE),
        port: data?.PORT || 21,
      });

      if (dirOut) {
        try {
          await client.ensureDir(dirOut);
        } catch (e) {}
      }

      try {
        await client.remove(fileIn);
      } catch (e) {}

      try {
        await client.uploadFrom(fileIn, fileOut);
      } catch (e) {}
    } catch(err) {
      console.log(err);
    }

    client.close();
  }

  private async anyFn(cmd: string[], data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    await this.app.getCommand().watch([...cmd, ...cwd.data], cwd.cwd).wait();
  }

  private async fetchAnyFn(cmd: any[], data: any): Promise<string> {
    const cwd = this.app.getCwd(data);
    return await this.app.getCommand().exec([...cmd, ...cwd.data], cwd.cwd);
  }
}