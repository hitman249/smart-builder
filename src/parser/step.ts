import type {App} from "../app";
import FileSystem from "../fs/file-system";
import Utils from "../helpers/utils";
import _ from "lodash";
import process from "process";

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
      case 'edit.Json':
        return this.editJson(value);
      case 'edit.Text':
        return this.editText(value);
      case 'shell.Echo':
        return this.shellEcho(value);
      case 'shell.Npm':
        return this.shellNpm(value);
      case 'shell.Sh':
        return this.shellSh(value);
      case 'shell.Gulp':
        return this.shellGulp(value);
      case 'shell.Git':
        return this.shellGit(value);
      case 'open.Url':
        return this.openUrl(value);
      case 'ares.Inspect':
        return this.aresInspect(value);
      case 'ares.Install':
        return this.aresInstall(value);
      case 'ares.Launch':
        return this.aresLaunch(value);
      case 'tizen.Install':
        return this.tizenInstall(value);
      case 'tizen.Package':
        return this.tizenPackage(value);
      case 'tizen.Run':
        return this.tizenRun(value);
      case 'tizen.Remove':
        return this.tizenRemove(value);
      case 'tizen.EmulatorStart':
        return this.tizenEmulatorStart(value);
      case 'vbox.Start':
        return this.vboxStart(value);
      case 'vbox.Pause':
        return this.vboxPause(value);
      case 'vbox.Resume':
        return this.vboxResume(value);
      case 'shell.Clean':
        return this.shellClean(value);
      case 'shell.Copy':
        return this.shellCopy(value);
      case 'shell.Mkdir':
        return this.shellMkdir(value);
    }
  }

  private async editJson(data: any): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    const path: string = hydrateData[1];
    const value: string = hydrateData[2];

    const json: any = Utils.jsonDecode(await this.fs.fileGetContentsByEncoding(file));
    _.set(json, path, value);

    await this.fs.filePutContents(file, Utils.jsonEncode(json));
  }

  private async editText(data: any): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(data);
    const file: string = '/' === hydrateData[0][0] ? hydrateData[0] : `${this.rootPath}/${hydrateData[0]}`;
    const text: string[] = hydrateData.slice(1);

    await this.fs.filePutContents(file, text.join('\n'));
  }

  private async shellEcho(data: any): Promise<void> {
    await this.anyFn(['echo'], data);
  }

  private async shellNpm(data: any): Promise<void> {
    await this.anyFn(['npm'], data);
  }

  private async shellSh(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    await this.app.getCommand().watch(cwd.data, cwd.cwd).wait();
  }

  private async shellGulp(data: any): Promise<void> {
    await this.anyFn(['npx', 'gulp'], data);
  }

  private async shellGit(data: any): Promise<void> {
    await this.anyFn(['git'], data);
  }

  private async openUrl(data: any): Promise<void> {
    await this.anyFn(['xdg-open'], data);
  }

  private async aresInspect(data: any): Promise<void> {
    await this.anyFn(['ares-inspect'], data);
  }

  private async aresInstall(data: any): Promise<void> {
    await this.anyFn(['ares-install'], data);
  }

  private async aresLaunch(data: any): Promise<void> {
    await this.anyFn(['ares-launch'], data);
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

  private async vboxStart(data: any): Promise<void> {
    await this.anyFn(['VBoxManage', 'startvm', Array.isArray(data) ? data[0] : data], []);
  }

  private async vboxPause(data: any): Promise<void> {
    await this.anyFn(['VBoxManage', 'controlvm', Array.isArray(data) ? data[0] : data, 'pause'], []);
  }

  private async vboxResume(data: any): Promise<void> {
    await this.anyFn(['VBoxManage', 'controlvm', Array.isArray(data) ? data[0] : data, 'resume'], []);
  }

  private async shellClean(data: any): Promise<void> {
    const cwd = this.app.getCwd(data);

    if (cwd.data && _.trim(this.rootPath, '/') !== _.trim(cwd.data, '/')) {
      await this.fs.rm('/' === cwd.data[0] ? cwd.data : `${this.rootPath}/${cwd.data}`);
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

    if (cwd.data && _.trim(this.rootPath, '/') !== _.trim(cwd.data, '/') ) {
      await this.fs.mkdir('/' === cwd.data[0] ? cwd.data : `${this.rootPath}/${cwd.data}`);
    }
  }

  private async anyFn(cmd: string[], data: any): Promise<void> {
    const cwd = this.app.getCwd(data);
    await this.app.getCommand().watch([...cmd, ...cwd.data], cwd.cwd).wait();
  }
}